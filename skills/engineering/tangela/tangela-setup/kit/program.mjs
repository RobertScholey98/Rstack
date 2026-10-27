#!/usr/bin/env node
// Starts, shows, points and archives the program this checkout belongs to.
// The store lives at user level; .tangela/program.json points at it.
//
//   node .tangela/scripts/program.mjs                     show it
//   node .tangela/scripts/program.mjs init <name> [--branch <b>]
//   node .tangela/scripts/program.mjs branch <b>
//   node .tangela/scripts/program.mjs unit <id> <field>=<value>...
//   node .tangela/scripts/program.mjs log <kind> <ref> "<decision>" [--why ".."] [--evidence ".."] [--by <who>]
//   node .tangela/scripts/program.mjs archive
//
// Exit codes: 0 done, 1 refused (the checkout or store isn't in a state
// where the command makes sense), 2 no program, when run with no command.

import { cpSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ContractError, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { isMain } from "./lib/main.mjs";
import {
  COLUMNS,
  findProgram,
  logDecision,
  ordersVersion,
  PROGRAM_FILE,
  requireProgram,
  setUnit,
  tangelaHome,
} from "./lib/store.mjs";

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "templates");
const STORE_FILES = ["orders.md", "units.tsv", "decisions.tsv", "ratchets.tsv", "attention.md"];
const STORE_FOLDERS = ["briefs", "reports", "retros", "investigations"];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function initProgram({ cwd = process.cwd(), name, branch = null, home = tangelaHome(), say = console.log }) {
  if (!NAME.test(name ?? "")) throw new ContractError(`The program name "${name}" must be lowercase kebab case`);
  const root = repoRoot(cwd);
  if (existsSync(join(root, PROGRAM_FILE))) {
    throw new ContractError(`This checkout already belongs to a program: see ${PROGRAM_FILE}`);
  }
  if (branch) requireBranch(root, branch);
  const store = join(home, "programs", repoName(root), name);
  if (existsSync(store)) throw new ContractError(`The store ${store} already exists`);

  try {
    mkdirSync(store, { recursive: true });
    for (const file of STORE_FILES) cpSync(join(TEMPLATES, file), join(store, file));
    for (const folder of STORE_FOLDERS) mkdirSync(join(store, folder));
    logDecision(store, { kind: "note", ref: name, decision: `Started the program in ${root}`, by: "coordinator" });
    writeProgram(root, { name, store, branch });
  } catch (error) {
    rmSync(store, { recursive: true, force: true });
    throw error;
  }

  say(`program  ${name}`);
  say(`branch   ${branch ?? "none yet"}`);
  say(`PROGRAM READY ${store}`);
  return { name, store, branch };
}

export function setBranch({ cwd = process.cwd(), branch, say = console.log }) {
  const root = repoRoot(cwd);
  const program = requireProgram(root);
  requireBranch(root, branch);
  writeProgram(root, { ...program, branch });
  logDecision(program.store, { kind: "note", ref: program.name, decision: `The integration branch is ${branch}`, by: "coordinator" });
  say(`PROGRAM BRANCH ${branch}`);
  return { ...program, branch };
}

// Sets fields on one unit's row in units.tsv, adding the row if it's new.
// `fields` are "<column>=<value>" strings.
export function setUnitFields({ cwd = process.cwd(), id, fields = [], say = console.log }) {
  if (!NAME.test(id ?? "")) throw new ContractError(`The unit id "${id}" must be lowercase kebab case`);
  const { store } = requireProgram(repoRoot(cwd));
  const settable = COLUMNS["units.tsv"].filter((column) => column !== "id" && column !== "updated");
  const values = {};
  for (const field of fields) {
    const at = field.indexOf("=");
    const key = at === -1 ? field : field.slice(0, at);
    if (at === -1 || !settable.includes(key)) {
      throw new ContractError(`"${field}" isn't <field>=<value> with a field from: ${settable.join(", ")}`);
    }
    values[key] = field.slice(at + 1);
  }
  const unit = setUnit(store, id, values);
  say(`UNIT ${unit.id} ${unit.state}`);
  return unit;
}

// Appends one row to decisions.tsv, so nobody edits the trail by hand.
export function logRow({ cwd = process.cwd(), kind, ref, decision, why, evidence, by = "coordinator", say = console.log }) {
  const { store } = requireProgram(repoRoot(cwd));
  logDecision(store, { kind, ref, decision, why, evidence, by });
  say(`LOGGED ${kind} ${ref ?? ""}`.trimEnd());
}

// The program this checkout belongs to, or null after printing PROGRAM NONE.
export function showProgram({ cwd = process.cwd(), say = console.log } = {}) {
  const program = findProgram(repoRoot(cwd));
  if (!program) {
    say("PROGRAM NONE");
    return null;
  }
  say(`program  ${program.name}`);
  say(`store    ${program.store}`);
  say(`branch   ${program.branch ?? "none yet"}`);
  say(`orders   version ${ordersVersion(program.store) ?? "unknown"}`);
  say(`PROGRAM ${program.name} ${program.store}`);
  return program;
}

export function archiveProgram({ cwd = process.cwd(), home = tangelaHome(), date = today(), say = console.log }) {
  const root = repoRoot(cwd);
  const program = requireProgram(root);
  const target = join(home, "programs", repoName(root), "archive", `${program.name}-${date}`);
  if (existsSync(target)) throw new ContractError(`${target} already exists`);

  const stranded = otherWorktrees(root).filter((path) => pointsAt(path, program.store));
  mkdirSync(dirname(target), { recursive: true });
  renameSync(program.store, target);
  logDecision(target, { kind: "note", ref: program.name, decision: `Archived the program to ${target}`, by: "coordinator" });
  rmSync(join(root, PROGRAM_FILE));
  if (stranded.length) {
    say("These worktrees still point at the old store. Remove them, or delete their .tangela/program.json:");
    for (const path of stranded) say(`  ${path}`);
  }
  say(`PROGRAM ARCHIVED ${target}`);
  return target;
}

// Every worktree of the repo except the one at root, as native paths.
function otherWorktrees(root) {
  const here = realpathSync.native(root);
  return git(["worktree", "list", "--porcelain"], { cwd: root })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)))
    .filter((path) => existsSync(path) && realpathSync.native(path) !== here);
}

// A worktree whose program.json is unreadable, or names another store, isn't
// this program's.
function pointsAt(worktree, store) {
  try {
    return findProgram(worktree)?.store === store;
  } catch {
    return false;
  }
}

// The base name of the folder holding the main checkout, the same from every
// worktree of the repo.
function repoName(root) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root });
  return basename(common) === ".git" ? basename(dirname(common)) : basename(common);
}

function requireBranch(root, branch) {
  if (git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root, allowFail: true }) === null) {
    throw new ContractError(`There is no local branch ${branch}`);
  }
}

function writeProgram(root, program) {
  mkdirSync(join(root, ".tangela"), { recursive: true });
  writeFileSync(join(root, PROGRAM_FILE), `${JSON.stringify(program, null, 2)}\n`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      branch: { type: "string" },
      why: { type: "string" },
      evidence: { type: "string" },
      by: { type: "string" },
    },
  });
  const [command, arg, ...rest] = positionals;
  try {
    if (!command) process.exit(showProgram() ? 0 : 2);
    else if (command === "init") initProgram({ name: arg, branch: values.branch });
    else if (command === "branch") setBranch({ branch: arg });
    else if (command === "unit") setUnitFields({ id: arg, fields: rest });
    else if (command === "log") logRow({ kind: arg, ref: rest[0], decision: rest[1], ...values });
    else if (command === "archive") archiveProgram({});
    else {
      throw new ContractError(
        "usage: program.mjs [init <name> [--branch <b>] | branch <b> | unit <id> <field>=<value>... | log <kind> <ref> <decision> | archive]",
      );
    }
  } catch (error) {
    console.error(`PROGRAM REFUSED ${error.message}`);
    process.exit(1);
  }
}
