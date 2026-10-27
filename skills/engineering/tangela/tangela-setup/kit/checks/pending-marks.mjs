#!/usr/bin/env node
// Fails on pending marks that should be gone: a mark naming a unit that has
// landed, or a unit the program doesn't have.
//
//   node .tangela/scripts/checks/pending-marks.mjs
//
// Reads the contract's "marks" field and the program's units.tsv. Exit codes:
// 0 clean, 1 problems, 2 the contract has no "marks" or the checkout no program.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ContractError, readContract, repoRoot } from "../lib/contract.mjs";
import { git } from "../lib/git.mjs";
import { matchesAny } from "../lib/glob.mjs";
import { isMain } from "../lib/main.mjs";
import { readTable, requireProgram } from "../lib/store.mjs";

const SNIFF_BYTES = 8000;

// Every mark in the tracked files the marks' paths cover, as { file, line, unit }.
export function findMarks(root, marks) {
  const files = git(["ls-files", "-z"], { cwd: root }).split("\0").filter(Boolean);
  const found = [];
  for (const file of files) {
    if (marks.paths.length && !matchesAny(file, marks.paths)) continue;
    let buffer;
    try {
      buffer = readFileSync(join(root, file));
    } catch {
      continue;
    }
    if (buffer.subarray(0, SNIFF_BYTES).includes(0)) continue;
    buffer
      .toString("utf8")
      .split(/\r?\n/)
      .forEach((text, i) => {
        for (const match of text.matchAll(new RegExp(marks.pattern, "g"))) {
          if (match[1]) found.push({ file, line: i + 1, unit: match[1] });
        }
      });
  }
  return found;
}

export function pendingMarks({ cwd = process.cwd(), say = console.log } = {}) {
  const root = repoRoot(cwd);
  const contract = readContract(root);
  if (!contract.marks) throw new ContractError(`The contract has no "marks" field`);
  const units = new Map(readTable(requireProgram(root).store, "units.tsv").map((unit) => [unit.id, unit]));

  const marks = findMarks(root, contract.marks);
  const problems = [];
  for (const mark of marks) {
    const unit = units.get(mark.unit);
    const why = !unit
      ? `names "${mark.unit}", which isn't in units.tsv`
      : unit.state === "landed"
        ? `names ${mark.unit}, which landed at ${unit.landed || "an unrecorded commit"}`
        : null;
    if (!why) continue;
    problems.push({ ...mark, why });
    say(`${mark.file}:${mark.line}: ${why}`);
  }
  say(problems.length ? `MARKS PROBLEMS ${problems.length} of ${marks.length}` : `MARKS OK ${marks.length} pending`);
  return { marks, problems };
}

if (isMain(import.meta.url)) {
  try {
    process.exit(pendingMarks().problems.length ? 1 : 0);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    console.log(`MARKS UNSET ${error.message}`);
    process.exit(2);
  }
}
