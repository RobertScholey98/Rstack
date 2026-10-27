import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ContractError } from "./contract.mjs";

export const PROGRAM_FILE = ".tangela/program.json";

export const UNIT_STATES = ["planned", "briefed", "running", "reported", "landed", "parked", "dropped"];

export const DECISION_KINDS = ["ruling", "default", "orders", "launch", "land", "park", "finding", "note"];

export const COLUMNS = {
  "units.tsv": ["id", "state", "title", "branch", "base", "depends", "spend", "landed", "updated"],
  "decisions.tsv": ["ts", "kind", "ref", "decision", "why", "evidence", "by"],
  "ratchets.tsv": ["name", "baseline", "target", "count", "measured", "command"],
};

export function tangelaHome() {
  return process.env.TANGELA_HOME ?? join(homedir(), ".claude", "tangela");
}

// The program this checkout belongs to, from .tangela/program.json, or null
// when it belongs to none.
export function findProgram(root) {
  const file = join(root, PROGRAM_FILE);
  if (!existsSync(file)) return null;
  const program = JSON.parse(readFileSync(file, "utf8"));
  if (!program.name || !program.store) {
    throw new ContractError(`${PROGRAM_FILE} needs a name and a store`);
  }
  if (!existsSync(program.store)) {
    throw new ContractError(`${PROGRAM_FILE} names the store ${program.store}, which doesn't exist`);
  }
  return program;
}

export function requireProgram(root) {
  const program = findProgram(root);
  if (!program) {
    throw new ContractError(`This checkout has no ${PROGRAM_FILE}. Start a program with program.mjs init.`);
  }
  return program;
}

// Rows of a store table as objects keyed by its header. Tabs and newlines
// inside a value are written as spaces, so a row is always one line.
export function readTable(store, name) {
  const file = join(store, name);
  if (!existsSync(file)) return [];
  const [header, ...lines] = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line !== "");
  const keys = header.split("\t");
  return lines.map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(keys.map((key, i) => [key, values[i] ?? ""]));
  });
}

export function writeTable(store, name, rows) {
  const keys = columnsFor(name);
  const lines = [keys.join("\t"), ...rows.map((row) => toLine(keys, row))];
  writeFileSync(join(store, name), `${lines.join("\n")}\n`);
}

export function appendRow(store, name, row) {
  const file = join(store, name);
  const keys = columnsFor(name);
  if (!existsSync(file)) writeFileSync(file, `${keys.join("\t")}\n`);
  appendFileSync(file, `${toLine(keys, row)}\n`);
}

export function logDecision(store, { kind, ref = "", decision, why = "", evidence = "", by }) {
  if (!DECISION_KINDS.includes(kind)) {
    throw new ContractError(`"${kind}" isn't a decision kind; kinds are ${DECISION_KINDS.join(", ")}`);
  }
  if (!decision || !by) throw new ContractError("A decision needs its text and who took it");
  appendRow(store, "decisions.tsv", { ts: new Date().toISOString(), kind, ref, decision, why, evidence, by });
}

// Changes one unit's row, or adds it. Returns the row as written.
export function setUnit(store, id, fields) {
  if (fields.state && !UNIT_STATES.includes(fields.state)) {
    throw new ContractError(`"${fields.state}" isn't a unit state; states are ${UNIT_STATES.join(", ")}`);
  }
  const units = readTable(store, "units.tsv");
  let unit = units.find((row) => row.id === id);
  if (!unit) {
    unit = { id, state: "planned" };
    units.push(unit);
  }
  Object.assign(unit, fields, { updated: new Date().toISOString() });
  writeTable(store, "units.tsv", units);
  return unit;
}

// The number on the orders' first line: "# Orders, version 3".
export function ordersVersion(store) {
  const file = join(store, "orders.md");
  if (!existsSync(file)) return null;
  const match = /^# Orders, version (\d+)/.exec(readFileSync(file, "utf8"));
  return match ? Number(match[1]) : null;
}

function columnsFor(name) {
  const keys = COLUMNS[name];
  if (!keys) throw new Error(`${name} isn't a store table`);
  return keys;
}

function toLine(keys, row) {
  return keys.map((key) => String(row[key] ?? "").replace(/[\t\r\n]+/g, " ")).join("\t");
}
