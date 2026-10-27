#!/usr/bin/env node
// Gathers the facts a unit report states, from the unit's worktree, as
// markdown ready to paste into the report: the commits since the base, the
// files changed, the tests added or changed, the pending marks flipped, and
// the last gate's verdict with whether it gated HEAD.
//
//   node .tangela/scripts/report-facts.mjs [--base <ref>]
//
// Without --base, the base is the one worktree.mjs recorded, else the
// contract's default branch. Exit codes: 0 printed, 2 broken setup or a
// base git can't find.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { findMarks } from "./checks/pending-marks.mjs";
import { duration } from "./gate.mjs";
import { readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { matchesAny } from "./lib/glob.mjs";
import { isMain } from "./lib/main.mjs";
import { unitBase } from "./lib/unit.mjs";

const TEST_FILE = /(^|\/)(tests?|__tests__|spec|e2e)\/|[._-](test|spec)\.[^/]+$|(^|\/)test_[^/]+\.py$/;
const STATUS = { A: "added", M: "changed", D: "deleted", R: "renamed", C: "copied", T: "changed" };

export function reportFacts({ cwd = process.cwd(), base, say = console.log } = {}) {
  const root = repoRoot(cwd);
  const contract = readContract(root);
  const { from, forkPoint, unit } = unitBase(root, contract, base);
  const head = git(["rev-parse", "HEAD"], { cwd: root });

  const commits = lines(git(["log", "--reverse", "--format=%h%x09%s", `${forkPoint}..HEAD`], { cwd: root })).map(
    (line) => line.split("\t"),
  );
  const files = lines(git(["diff", "--name-status", "--find-renames", forkPoint, "HEAD"], { cwd: root })).map((line) => {
    const [code, ...paths] = line.split("\t");
    return { status: STATUS[code[0]] ?? code, path: paths.at(-1) };
  });
  const tests = files.filter((file) => TEST_FILE.test(file.path) && file.status !== "deleted");
  const code = (text) => `\`${text}\``;

  const out = [`**Gate**: ${gateLine(root, head)}`, "", "## Commits", ""];
  if (commits.length) {
    out.push("| Commit | Step |", "| --- | --- |");
    for (const [sha, subject] of commits) out.push(`| ${sha} | ${subject.replaceAll("|", "\\|")} |`);
  } else {
    out.push(`None since ${from}.`);
  }
  out.push("", "## Files changed", "");
  out.push(...(files.length ? files.map((file) => `- ${file.status} ${code(file.path)}`) : ["None."]));
  out.push("", "## Tests added or changed", "");
  out.push(...(tests.length ? tests.map((file) => `- ${file.status} ${code(file.path)}`) : ["None."]));

  if (contract.marks) {
    const flipped = flippedMarks(root, contract.marks, forkPoint);
    out.push("", "## Pending marks", "");
    if (!flipped.length) out.push("- flipped: none");
    for (const mark of flipped) out.push(`- flipped: ${mark.unit}, ${mark.count} in ${mark.files.map(code).join(", ")}`);
    if (unit) {
      const left = findMarks(root, contract.marks).filter((mark) => mark.unit === unit);
      out.push(`- still pending for ${unit}: ${left.map((mark) => code(`${mark.file}:${mark.line}`)).join(", ") || "none"}`);
    }
  }

  out.push("", `FACTS ${commits.length} commits`);
  for (const line of out) say(line);
  return { base: from, commits: commits.length, files, tests };
}

// The marks the diff removed, per unit. A removed line that the diff adds
// back word for word only moved, so it isn't counted.
function flippedMarks(root, marks, forkPoint) {
  const removed = [];
  const added = new Map();
  let file = null;
  let oldFile = null;
  for (const line of lines(git(["diff", "-U0", "--no-color", forkPoint, "HEAD"], { cwd: root }))) {
    if (line.startsWith("diff --git ")) {
      file = oldFile = null;
    } else if (file === null && line.startsWith("--- ")) {
      oldFile = line.replace(/^--- (a\/)?/, "");
    } else if (file === null && line.startsWith("+++ ")) {
      const newFile = line.replace(/^\+\+\+ (b\/)?/, "");
      file = newFile === "/dev/null" ? oldFile : newFile;
    } else if (file && /^[+-]/.test(line) && (!marks.paths.length || matchesAny(file, marks.paths))) {
      const text = line.slice(1).trim();
      for (const match of text.matchAll(new RegExp(marks.pattern, "g"))) {
        if (line[0] === "+") added.set(text, (added.get(text) ?? 0) + 1);
        else removed.push({ unit: match[1], file, text });
      }
    }
  }

  const units = new Map();
  for (const mark of removed) {
    if (added.get(mark.text)) {
      added.set(mark.text, added.get(mark.text) - 1);
      continue;
    }
    const entry = units.get(mark.unit) ?? { unit: mark.unit, count: 0, files: [] };
    entry.count++;
    if (!entry.files.includes(mark.file)) entry.files.push(mark.file);
    units.set(mark.unit, entry);
  }
  return [...units.values()];
}

function gateLine(root, head) {
  const file = join(root, ".tangela", "logs", "last-gate.json");
  if (!existsSync(file)) return "no gate has run in this worktree";
  const record = JSON.parse(readFileSync(file, "utf8"));
  const line = `GATE ${record.verdict} ${record.ranTier} at ${record.head.slice(0, 12)} in ${duration(record.ms)}`;
  if (record.head !== head) return `${line} (it gated ${record.head.slice(0, 12)}, not HEAD; run the gate again)`;
  if (record.dirty) return `${line} (it gated HEAD with uncommitted changes; run the gate again on a clean tree)`;
  return `${line} (gated HEAD)`;
}

function lines(text) {
  return text.split("\n").filter(Boolean);
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { base: { type: "string" } } });
  try {
    reportFacts({ base: values.base });
  } catch (error) {
    console.error(`FACTS BROKEN ${error.message}`);
    process.exit(2);
  }
}
