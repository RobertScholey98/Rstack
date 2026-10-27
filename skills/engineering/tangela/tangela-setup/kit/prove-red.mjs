#!/usr/bin/env node
// Proves a test red: runs it on the current code, where it must pass, then
// swaps the named source files for their versions at the base and runs it
// again, where it must fail. The files are always put back.
//
//   node .tangela/scripts/prove-red.mjs --run "<command>" <file>... [--base <ref>]
//
// The old version of a file is the one where this branch left the base.
// Without --base, the base is the one worktree.mjs recorded, else the
// contract's default branch. Exit codes: 0 red proven, 1 not red (the
// command passed on the old code), 2 broken: a named file has uncommitted
// changes or didn't exist at the base, or the command fails on the current
// code too.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ContractError, readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { isMain } from "./lib/main.mjs";
import { unitBase } from "./lib/unit.mjs";

const EXIT = { RED: 0, NOT_RED: 1, BROKEN: 2 };
const TAIL = 20;
const CTRL_C_WINDOWS = 0xc000013a;

export function proveRed({ cwd = process.cwd(), run, files, base, say = console.log }) {
  if (!run) throw new ContractError('Give the test command with --run "<command>"');
  if (!files?.length) throw new ContractError("Name the source files the fix changed");
  const root = repoRoot(cwd);
  const contract = readContract(root);
  const { from, forkPoint } = unitBase(root, contract, base);

  const paths = files.map((file) => git(["ls-files", "--full-name", "--error-unmatch", file], { cwd, allowFail: true }) ?? file);
  for (const path of paths) {
    if (git(["status", "--porcelain", "--", path], { cwd: root }) !== "") {
      throw new ContractError(`${path} has uncommitted changes; commit them first so they can't be lost`);
    }
    if (git(["cat-file", "-e", `${forkPoint}:${path}`], { cwd: root, allowFail: true }) === null) {
      throw new ContractError(`${path} didn't exist at ${from}; name only files the fix changed`);
    }
  }

  say(`now      ${run}`);
  const now = sh(run, root);
  if (now.code !== 0) {
    tail(now.output, say);
    throw new ContractError("The command fails on the current code, so a failure on the old code would prove nothing");
  }

  const current = paths.map((path) => [path, readFileSync(join(root, path))]);
  const restore = () => {
    for (const [path, bytes] of current) writeFileSync(join(root, path), bytes);
  };
  // A listener stops Ctrl+C killing this process while the old files are in
  // place. The command itself still gets the signal, and sh() reports it.
  const onSignal = () => {};
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  let old;
  try {
    for (const path of paths) {
      writeFileSync(join(root, path), git(["cat-file", "--filters", `${forkPoint}:${path}`], { cwd: root, encoding: "buffer" }));
    }
    say(`old code ${paths.join(", ")} as at ${forkPoint.slice(0, 12)}`);
    old = sh(run, root);
  } finally {
    restore();
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
  say(`restored ${paths.join(", ")}`);
  if (old.interrupted) throw new ContractError("The command was interrupted, so its failure proves nothing");

  if (old.code === 0) {
    say("NOT RED the command passed on the old code, so the test doesn't catch the bug");
    return "NOT_RED";
  }
  tail(old.output, say);
  say(`RED PROVEN the command exited ${old.code} on the old code and passes on the new`);
  return "RED";
}

function sh(command, cwd) {
  const result = spawnSync(command, { cwd, shell: true, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const interrupted = Boolean(result.signal) || result.status === 130 || result.status === CTRL_C_WINDOWS;
  return { code: result.status ?? 1, interrupted, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function tail(output, say) {
  for (const line of output.split(/\r?\n/).filter((l) => l.trim()).slice(-TAIL)) say(`  | ${line}`);
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { run: { type: "string" }, base: { type: "string" } },
  });
  try {
    process.exit(EXIT[proveRed({ run: values.run, files: positionals, base: values.base })]);
  } catch (error) {
    console.error(`PROVE RED BROKEN ${error.message}`);
    process.exit(EXIT.BROKEN);
  }
}
