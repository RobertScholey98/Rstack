#!/usr/bin/env node
// Preflight for a checkout: prints one line per check, each marked PROBLEM
// when it needs fixing before work goes on, or NOTE when the doctor skill
// should judge it. Notes don't count as problems. With --launch it also decides
// whether one more worker may start, from the orders' concurrency section,
// the running units and the machine's load.
//
//   node .tangela/scripts/doctor.mjs [--launch]
//
// Exit codes: 0 ok, 1 problems, 2 the contract or setup is broken, 3 hold
// (with --launch: don't start another worker yet).

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { cpus, freemem, totalmem } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { drift } from "./checks/drift.mjs";
import { ContractError, expectedNode, nodeMatches, readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { isMain } from "./lib/main.mjs";
import { findProgram, readTable, tangelaHome } from "./lib/store.mjs";

const EXIT = { OK: 0, PROBLEMS: 1, BROKEN: 2, HOLD: 3 };
const HOOK_MARK = ".tangela/scripts/checks/eol-bom.mjs";
const CONCURRENCY = { cpu: 75, memory: 85, ceiling: 4 };
// Hook managers' config files at the repo root, which generate the hook git runs.
const HOOK_CONFIGS = ["lefthook.yml", "lefthook.yaml", ".lefthook.yml", ".lefthook.yaml", ".pre-commit-config.yaml", ".simple-git-hooks.json", "package.json"];

export async function doctor({
  cwd = process.cwd(),
  launch = false,
  home = tangelaHome(),
  sampleLoad = sampleMachineLoad,
  say = console.log,
} = {}) {
  const root = repoRoot(cwd);
  const contract = readContract(root);
  const program = findProgram(root);
  const load = await sampleLoad();

  const lines = [
    checkNode(root, contract),
    checkHooks(root),
    checkKit(root),
    checkLock(home),
    await checkPorts(root, contract),
    checkForeignCommits(root, contract, program),
    checkDrift(root),
    { label: "load", text: `cpu ${load.cpu}%, memory ${load.memory}% used` },
  ];
  for (const { label, text, problem, note } of lines) {
    say(`${label.padEnd(10)}${problem ? "PROBLEM " : note ? "NOTE " : ""}${text}`);
  }
  const problems = lines.filter((line) => line.problem).length;

  let hold = [];
  if (launch) {
    const limits = program ? concurrency(program.store) : CONCURRENCY;
    const running = program ? readTable(program.store, "units.tsv").filter((unit) => unit.state === "running").length : 0;
    say(`${"launch".padEnd(10)}${running} running of ${limits.ceiling}; launch under cpu ${limits.cpu}% and memory ${limits.memory}%`);
    hold = [
      !program && "this checkout belongs to no program",
      running >= limits.ceiling && `${running} units running, and the ceiling is ${limits.ceiling}`,
      load.cpu > limits.cpu && `cpu ${load.cpu}% is over ${limits.cpu}%`,
      load.memory > limits.memory && `memory ${load.memory}% is over ${limits.memory}%`,
    ].filter(Boolean);
  }

  const verdict = hold.length ? "HOLD" : problems ? "PROBLEMS" : "OK";
  say(verdict === "HOLD" ? `DOCTOR HOLD ${hold.join("; ")}` : verdict === "PROBLEMS" ? `DOCTOR PROBLEMS ${problems}` : "DOCTOR OK");
  return { verdict, problems, hold, load };
}

function checkNode(root, contract) {
  const expected = expectedNode(root, contract);
  if (!expected) return { label: "node", text: `${process.version}, and nothing pins a version` };
  if (nodeMatches(expected.version)) return { label: "node", text: `${process.version}, as ${expected.from} asks` };
  return { label: "node", text: `${process.version}, but ${expected.from} asks for ${expected.version}`, problem: true };
}

function checkHooks(root) {
  const configured = git(["config", "core.hooksPath"], { cwd: root, allowFail: true });
  const dir = resolve(root, configured ?? git(["rev-parse", "--git-path", "hooks"], { cwd: root }));
  const named = configured ? `core.hooksPath ${configured}` : "core.hooksPath is unset, and .git/hooks";
  const hook = join(dir, "pre-commit");
  // A manager such as husky points core.hooksPath at a generated shim that
  // runs the committed script in the folder above it.
  const shimmed = configured ? [join(dirname(dir), "pre-commit")] : [];
  const places = [hook, ...shimmed, ...HOOK_CONFIGS.map((file) => join(root, file))];
  const holder = places.find((file) => existsSync(file) && readFileSync(file, "utf8").includes(HOOK_MARK));
  if (holder === hook) return { label: "hooks", text: `${named} runs the tangela block` };
  if (holder) {
    const under = configured ? `, under core.hooksPath ${configured}` : "";
    return { label: "hooks", text: `the tangela block is in ${relative(root, holder).split(sep).join("/")}${under}` };
  }
  if (!existsSync(hook)) return { label: "hooks", text: `${named} has no pre-commit`, problem: true };
  return { label: "hooks", text: `${named} has a pre-commit without the tangela block`, problem: true };
}

function checkKit(root) {
  const stamp = join(root, ".tangela", "scripts", "kit.json");
  if (!existsSync(stamp)) return { label: "kit", text: "no .tangela/scripts/kit.json; run /tangela-setup", problem: true };
  return { label: "kit", text: `version ${JSON.parse(readFileSync(stamp, "utf8")).version}` };
}

function checkLock(home) {
  const dir = join(home, "locks", "e2e");
  if (!existsSync(dir)) return { label: "e2e lock", text: "free" };
  try {
    const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
    return { label: "e2e lock", text: `held by "${owner.step}" in ${owner.repo} since ${owner.since}, pid ${owner.pid}` };
  } catch {
    return { label: "e2e lock", text: "held by a run that is just starting" };
  }
}

async function checkPorts(root, contract) {
  const range = contract.worktree.ports;
  if (!range) return { label: "ports", text: "the contract names no port range" };
  const claims = new Map();
  for (const line of git(["worktree", "list", "--porcelain"], { cwd: root }).split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    try {
      const { port, unit } = JSON.parse(readFileSync(join(line.slice("worktree ".length), ".tangela", "worktree.json"), "utf8"));
      if (port) claims.set(port, unit);
    } catch {
      // A checkout without a record claims no port.
    }
  }
  const held = [];
  let free = 0;
  for (let port = range[0]; port <= range[1]; port++) {
    const busy = !(await canListen(port));
    if (claims.has(port)) held.push(`${port} ${claims.get(port)}${busy ? "" : " (not listening)"}`);
    else if (busy) held.push(`${port} in use outside any worktree`);
    else free++;
  }
  const text = `${range[0]}-${range[1]}: ${[...held, `${free} free`].join(", ")}`;
  return { label: "ports", text, problem: free === 0 };
}

// Commits on the integration branch after the last landing that no unit
// made. Commits that only add landing log entries are the landings' own.
function checkForeignCommits(root, contract, program) {
  if (!program?.branch) return { label: "branch", text: "no integration branch" };
  const landed = new Set(readTable(program.store, "units.tsv").map((unit) => unit.landed).filter(Boolean));
  const history = git(["rev-list", "--first-parent", program.branch], { cwd: root, allowFail: true });
  if (history === null) return { label: "branch", text: `${program.branch} doesn't exist`, problem: true };
  const commits = history.split("\n");
  const last = commits.findIndex((sha) => [...landed].some((short) => sha.startsWith(short)));
  if (last === -1) return { label: "branch", text: `${program.branch}, nothing landed yet` };
  const logDir = `${contract.log.replace(/\/+$/, "")}/`;
  const foreign = commits.slice(0, last).filter((sha) => {
    const files = git(["diff", "--name-only", `${sha}^`, sha], { cwd: root });
    return files.split("\n").some((file) => file && !file.startsWith(logDir));
  });
  if (!foreign.length) return { label: "branch", text: `${program.branch}, nothing since the last landing` };
  const list = foreign.map((sha) => git(["log", "-1", "--format=%h %s", sha], { cwd: root })).join("; ");
  return { label: "branch", text: `${program.branch} has ${foreign.length} commits since the last landing that no unit made: ${list}`, note: true };
}

function checkDrift(root) {
  const { pairs } = drift({ cwd: root, say: () => {} });
  if (!pairs.length) return { label: "drift", text: "no rule stated twice" };
  return { label: "drift", text: `${pairs.length} rules stated in two files; run checks/drift.mjs`, note: true };
}

// The orders' Concurrency section: "CPU 75%", "memory 85%", "ceiling 4", each
// overriding its default where the section states it.
export function concurrency(store) {
  const file = join(store, "orders.md");
  if (!existsSync(file)) return { ...CONCURRENCY };
  const section = /^##\s+Concurrency\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im.exec(readFileSync(file, "utf8"))?.[1] ?? "";
  const number = (pattern, fallback) => Number(pattern.exec(section)?.[1] ?? fallback);
  return {
    cpu: number(/\bcpu\b[^\n\d]*(\d+)\s*%/i, CONCURRENCY.cpu),
    memory: number(/\bmemory\b[^\n\d]*(\d+)\s*%/i, CONCURRENCY.memory),
    ceiling: number(/\bceiling\b[^\n\d]*(\d+)/i, CONCURRENCY.ceiling),
  };
}

async function sampleMachineLoad(ms = 500) {
  const before = cpus();
  await new Promise((done) => setTimeout(done, ms));
  let idle = 0;
  let total = 0;
  cpus().forEach((cpu, i) => {
    for (const [kind, time] of Object.entries(cpu.times)) {
      const spent = time - before[i].times[kind];
      total += spent;
      if (kind === "idle") idle += spent;
    }
  });
  return {
    cpu: total ? Math.round(100 * (1 - idle / total)) : 0,
    memory: Math.round(100 * (1 - freemem() / totalmem())),
  };
}

function canListen(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { launch: { type: "boolean" } } });
  try {
    const { verdict } = await doctor({ launch: values.launch });
    process.exit(EXIT[verdict]);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    console.log(`DOCTOR BROKEN ${error.message}`);
    process.exit(EXIT.BROKEN);
  }
}
