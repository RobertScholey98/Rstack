#!/usr/bin/env node
// Runs one verification tier from the repo contract and prints a verdict.
//
//   node .tangela/scripts/gate.mjs <tier> [--base <ref>] [--no-rerun] [--lock-timeout <minutes>]
//
// Exit codes: 0 pass, 1 fail, 2 the contract or setup is broken,
// 3 every failure passed when rerun alone (load).

import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus, freemem, homedir, totalmem } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { ContractError, expectedNode, nodeMatches, readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { matchesAny } from "./lib/glob.mjs";
import { isMain } from "./lib/main.mjs";

const EXIT = { PASS: 0, FAIL: 1, BROKEN: 2, LOAD: 3 };
const MAX_RERUNS = 5;
const STALE_LOCK_MS = 6 * 60 * 60_000;

class LockTimeout extends Error {}

export function tangelaHome() {
  return process.env.TANGELA_HOME ?? join(homedir(), ".claude", "tangela");
}

export async function gate({
  cwd = process.cwd(),
  tier,
  base,
  rerun = true,
  lockTimeoutMs = 60 * 60_000,
  home = tangelaHome(),
  say = console.log,
}) {
  const root = repoRoot(cwd);
  const contract = readContract(root);
  if (!contract.tiers[tier]) throw new ContractError(`The contract has no "${tier}" tier`);

  const startedAt = Date.now();
  const head = git(["rev-parse", "HEAD"], { cwd: root });
  const dirty = git(["status", "--porcelain"], { cwd: root }) !== "";
  const { ranTier, why } = chooseTier(root, contract, tier, base ?? contract.defaultBranch);
  const expected = expectedNode(root, contract);
  const node = {
    version: process.version,
    expected: expected?.version ?? null,
    from: expected?.from ?? null,
    ok: nodeMatches(expected?.version),
  };

  say(`gate ${tier}${why ? `, widened because it ${why}` : ""}, at ${head.slice(0, 12)}${dirty ? " with uncommitted changes" : ""}`);
  say(`node ${process.version}${!expected ? "" : node.ok ? `, as ${expected.from} asks` : `, but ${expected.from} asks for ${expected.version}`}`);
  const loadBefore = await sampleLoad();
  say(`load ${formatLoad(loadBefore)}`);

  const logDir = join(root, ".tangela", "logs");
  mkdirSync(logDir, { recursive: true });
  const results = [];
  for (const step of contract.tiers[ranTier]) {
    if (results.some((result) => !result.ok)) {
      results.push({ name: step.name, ok: null, skipped: true });
      say(`  skip  ${step.name}`);
      continue;
    }
    const result = await runStep(root, step, { logDir, home, lockTimeoutMs, rerun, say });
    results.push(result);
    say(`  ${result.ok ? "pass" : "FAIL"}  ${step.name}  ${duration(result.ms)}`);
    if (!result.ok) describeFailure(result, say);
  }

  const failed = results.filter((result) => result.ok === false);
  const verdict = !failed.length ? "PASS" : failed.every(passedAlone) ? "LOAD" : "FAIL";
  const loadAfter = await sampleLoad();
  const record = {
    verdict,
    tier,
    ranTier,
    why,
    head,
    dirty,
    node,
    startedAt: new Date(startedAt).toISOString(),
    ms: Date.now() - startedAt,
    load: { before: loadBefore, after: loadAfter },
    steps: results,
  };
  writeFileSync(join(logDir, "last-gate.json"), `${JSON.stringify(record, null, 2)}\n`);

  say(`load ${formatLoad(loadAfter)}`);
  const nodeNote = node.ok ? "" : ` (node ${process.version}, expected ${node.expected})`;
  say(`GATE ${verdict} ${ranTier} at ${head.slice(0, 12)} in ${duration(record.ms)}${nodeNote}`);
  return record;
}

function chooseTier(root, contract, tier, base) {
  if (tier !== "unit" || !contract.tiers.widened || !contract.widen.length) return { ranTier: tier, why: null };
  const changed = changedFiles(root, base);
  if (!changed) return { ranTier: "widened", why: `can't be diffed against ${base}` };
  const hits = changed.filter((file) => matchesAny(file, contract.widen));
  if (!hits.length) return { ranTier: tier, why: null };
  const more = hits.length > 3 ? ` and ${hits.length - 3} more` : "";
  return { ranTier: "widened", why: `touches ${hits.slice(0, 3).join(", ")}${more}` };
}

function changedFiles(root, base) {
  const committed = git(["diff", "--name-only", `${base}...HEAD`], { cwd: root, allowFail: true });
  if (committed === null) return null;
  const uncommitted = git(["diff", "--name-only", "HEAD"], { cwd: root });
  const untracked = git(["ls-files", "--others", "--exclude-standard"], { cwd: root });
  return [...new Set([committed, uncommitted, untracked].join("\n").split("\n").filter(Boolean))];
}

async function runStep(root, step, { logDir, home, lockTimeoutMs, rerun, say }) {
  let release = () => {};
  if (step.lock) {
    try {
      release = await acquireLock(home, { root, step: step.name, timeoutMs: lockTimeoutMs, say });
    } catch (error) {
      if (!(error instanceof LockTimeout)) throw error;
      return { name: step.name, ok: false, ms: 0, error: error.message, failures: [] };
    }
  }

  try {
    const started = Date.now();
    const log = join(logDir, `${stamp()}-${slug(step.name)}.log`);
    const { code, output } = await sh(step.run, root, log);
    const result = { name: step.name, ok: code === 0, code, ms: Date.now() - started, log: posix(relative(root, log)) };
    if (result.ok) return result;

    result.failures = step.failures ? failureNames(output, step.failures) : [];
    result.tail = output.split(/\r?\n/).filter((line) => line.trim()).slice(-15);
    if (rerun && step.rerun && result.failures.length) {
      result.reruns = [];
      for (const test of result.failures.slice(0, MAX_RERUNS)) {
        result.reruns.push(await rerunAlone(root, step, test, logDir));
      }
    }
    return result;
  } finally {
    release();
  }
}

function failureNames(output, pattern) {
  const names = [...output.matchAll(new RegExp(pattern, "gm"))].map((match) => (match[1] ?? match[0]).trim());
  return [...new Set(names)].filter(Boolean);
}

async function rerunAlone(root, step, test, logDir) {
  const runs = step.repeat ?? 3;
  const command = step.rerun.replaceAll("{test}", quote(test));
  const log = join(logDir, `${stamp()}-${slug(step.name)}-rerun.log`);
  let passes = 0;
  for (let i = 0; i < runs; i++) {
    if ((await sh(command, root, log, true)).code === 0) passes++;
  }
  return { test, runs, passes, log: posix(relative(root, log)) };
}

function passedAlone(result) {
  if (!result.failures?.length || result.failures.length > MAX_RERUNS) return false;
  return result.reruns?.length === result.failures.length && result.reruns.every((r) => r.passes === r.runs);
}

function describeFailure(result, say) {
  if (result.error) {
    say(`        ${result.error}`);
    return;
  }
  if (!result.failures.length) {
    say(`        no failed test names found, so the last lines of ${result.log}:`);
    for (const line of result.tail) say(`        | ${line}`);
    return;
  }
  for (const test of result.failures) {
    const rerun = result.reruns?.find((r) => r.test === test);
    const note = !rerun
      ? "not rerun"
      : rerun.passes === rerun.runs
        ? `passed alone ${rerun.passes}/${rerun.runs}: load`
        : `failed alone ${rerun.runs - rerun.passes}/${rerun.runs}: real, or already broken on the base`;
    say(`        ${test}  (${note})`);
  }
  say(`        log: ${result.log}`);
}

function sh(command, cwd, logPath, append = false) {
  return new Promise((resolve, reject) => {
    const log = createWriteStream(logPath, { flags: append ? "a" : "w" });
    log.write(`$ ${command}\n`);
    const child = spawn(command, { cwd, shell: true, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
    const chunks = [];
    const take = (chunk) => {
      chunks.push(chunk);
      log.write(chunk);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(chunks).toString("utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
      log.end(() => resolve({ code: code ?? 1, output }));
    });
  });
}

// One e2e run per machine: a folder is created atomically, and a holder that
// has died or run for hours loses it.
async function acquireLock(home, { root, step, timeoutMs, say }) {
  const dir = join(home, "locks", "e2e");
  mkdirSync(dirname(dir), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let waiting = false;
  for (;;) {
    try {
      mkdirSync(dir);
      const owner = { pid: process.pid, repo: root, step, since: new Date().toISOString() };
      writeFileSync(join(dir, "owner.json"), JSON.stringify(owner));
      const release = () => rmSync(dir, { recursive: true, force: true });
      process.once("exit", release);
      return () => {
        process.removeListener("exit", release);
        release();
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }

    const owner = readOwner(dir);
    if (isStale(dir, owner)) {
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (Date.now() >= deadline) {
      throw new LockTimeout(`timed out waiting for the e2e lock, held by ${describeOwner(owner)}`);
    }
    if (!waiting) {
      say(`  wait  e2e lock, held by ${describeOwner(owner)}`);
      waiting = true;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(50, Math.min(2000, deadline - Date.now()))));
  }
}

function readOwner(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

function isStale(dir, owner) {
  if (!owner) {
    // The holder writes owner.json just after taking the lock, so give it a moment.
    try {
      return Date.now() - statSync(dir).mtimeMs > 10_000;
    } catch {
      return true;
    }
  }
  return !isAlive(owner.pid) || Date.now() - Date.parse(owner.since) > STALE_LOCK_MS;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function describeOwner(owner) {
  return owner ? `"${owner.step}" in ${owner.repo} since ${owner.since}` : "a run that is just starting";
}

async function sampleLoad(ms = 300) {
  const before = cpus();
  await new Promise((resolve) => setTimeout(resolve, ms));
  const after = cpus();
  let idle = 0;
  let total = 0;
  after.forEach((cpu, i) => {
    for (const [kind, time] of Object.entries(cpu.times)) {
      const spent = time - before[i].times[kind];
      total += spent;
      if (kind === "idle") idle += spent;
    }
  });
  return {
    cpu: total ? Math.round(100 * (1 - idle / total)) : 0,
    cores: after.length,
    freeGb: Number((freemem() / 2 ** 30).toFixed(1)),
    totalGb: Number((totalmem() / 2 ** 30).toFixed(1)),
  };
}

function formatLoad({ cpu, cores, freeGb, totalGb }) {
  return `cpu ${cpu}% of ${cores} cores, ${freeGb} of ${totalGb} GB memory free`;
}

function duration(ms) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

function quote(text) {
  return `"${text.replace(/"/g, '\\"')}"`;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function posix(path) {
  return path.split(sep).join("/");
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string" },
      "no-rerun": { type: "boolean" },
      "lock-timeout": { type: "string" },
    },
  });
  const [tier] = positionals;
  if (!tier) {
    console.error("usage: gate.mjs <tier> [--base <ref>] [--no-rerun] [--lock-timeout <minutes>]");
    process.exit(EXIT.BROKEN);
  }
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
  try {
    const record = await gate({
      tier,
      base: values.base,
      rerun: !values["no-rerun"],
      lockTimeoutMs: values["lock-timeout"] === undefined ? undefined : Number(values["lock-timeout"]) * 60_000,
    });
    process.exit(EXIT[record.verdict]);
  } catch (error) {
    console.error(`GATE BROKEN ${error.message}`);
    process.exit(EXIT.BROKEN);
  }
}
