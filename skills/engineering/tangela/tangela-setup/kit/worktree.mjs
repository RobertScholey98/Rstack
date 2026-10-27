#!/usr/bin/env node
// Creates a worktree for one unit: from the right base, with the gitignored
// files the contract lists, the kit, a scratch folder and a free port.
//
//   node .tangela/scripts/worktree.mjs <unit> [--base <ref>] [--no-install]
//
// Without --base, work starts from the contract's default branch; program
// work passes the program's integration branch. Exit codes: 0 ready,
// 1 created but something is missing, 2 not created.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { ContractError, expectedNode, nodeMatches, readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { isMain } from "./lib/main.mjs";

const UNIT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KIT_ITEMS = ["scripts", "machine.md"];

export async function createWorktree({ cwd = process.cwd(), unit, base, install = true, say = console.log }) {
  if (!UNIT.test(unit ?? "")) throw new ContractError(`The unit name "${unit}" must be lowercase kebab case`);
  const source = repoRoot(cwd);
  const contract = readContract(source);
  const settings = { root: "../{repo}.worktrees/{unit}", branch: "tangela/{unit}", copy: [], ...contract.worktree };
  const fill = (template) => template.replaceAll("{repo}", basename(source)).replaceAll("{unit}", unit);
  const path = resolve(source, fill(settings.root));
  const branch = fill(settings.branch);
  const from = base ?? contract.defaultBranch;
  if (existsSync(path)) throw new ContractError(`${path} already exists`);

  git(["worktree", "add", "-b", branch, path, from], { cwd: source });
  say(`worktree  ${path}`);
  say(`branch    ${branch}, from ${from}${base ? "" : ", the contract's default branch"}`);

  const problems = [];
  for (const file of settings.copy) {
    if (!existsSync(join(source, file))) {
      problems.push(`${file} isn't in ${source}, so the new worktree doesn't have it either`);
      continue;
    }
    copy(join(source, file), join(path, file));
    say(`copied    ${file}`);
  }
  for (const item of KIT_ITEMS) {
    if (existsSync(join(source, ".tangela", item))) copy(join(source, ".tangela", item), join(path, ".tangela", item));
  }

  const scratch = join(path, ".tangela", "scratch", unit);
  mkdirSync(scratch, { recursive: true });
  say(`scratch   ${posix(relative(path, scratch))}`);

  let port = null;
  if (settings.ports) {
    port = await freePort(settings.ports, claimedPorts(source));
    if (port === null) problems.push(`no port between ${settings.ports[0]} and ${settings.ports[1]} is free`);
    else say(`port      ${port}`);
  }
  const record = { unit, branch, base: from, port, scratch: posix(relative(path, scratch)), created: new Date().toISOString() };
  writeFileSync(join(path, ".tangela", "worktree.json"), `${JSON.stringify(record, null, 2)}\n`);

  if (install && settings.install) {
    say(`install   ${settings.install}`);
    const log = join(path, ".tangela", "logs", "install.log");
    mkdirSync(dirname(log), { recursive: true });
    const result = spawnSync(settings.install, { cwd: path, shell: true, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    writeFileSync(log, `${result.stdout ?? ""}${result.stderr ?? ""}`);
    if (result.status !== 0) problems.push(`the install failed, see ${posix(relative(path, log))}`);
  }

  const hooksPath = git(["config", "core.hooksPath"], { cwd: path, allowFail: true });
  if (hooksPath && !existsSync(resolve(path, hooksPath))) {
    problems.push(`core.hooksPath is ${hooksPath}, which doesn't exist in the new worktree, so commit hooks won't run`);
  }

  const expected = expectedNode(path, contract);
  if (expected && !nodeMatches(expected.version)) {
    problems.push(`node is ${process.version}, but ${expected.from} asks for ${expected.version}`);
  }

  for (const problem of problems) say(`PROBLEM   ${problem}`);
  return { ...record, path, problems };
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Ports other worktrees of this repo have already been given.
function claimedPorts(source) {
  const ports = new Set();
  const list = git(["worktree", "list", "--porcelain"], { cwd: source });
  for (const line of list.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const file = join(line.slice("worktree ".length), ".tangela", "worktree.json");
    try {
      const { port } = JSON.parse(readFileSync(file, "utf8"));
      if (port) ports.add(port);
    } catch {
      // No record, or one being written: that worktree claims nothing.
    }
  }
  return ports;
}

async function freePort([low, high], claimed) {
  for (let port = low; port <= high; port++) {
    if (claimed.has(port)) continue;
    if ((await canListen(port, "127.0.0.1")) && (await canListen(port, "::1"))) return port;
  }
  return null;
}

function canListen(port, host) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", (error) => done(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT"));
    server.listen(port, host, () => server.close(() => done(true)));
  });
}

function posix(path) {
  return path.split(sep).join("/");
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { base: { type: "string" }, "no-install": { type: "boolean" } },
  });
  try {
    const result = await createWorktree({ unit: positionals[0], base: values.base, install: !values["no-install"] });
    process.exit(result.problems.length ? 1 : 0);
  } catch (error) {
    console.error(`WORKTREE NOT CREATED ${error.message}`);
    process.exit(2);
  }
}
