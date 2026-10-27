#!/usr/bin/env node
// Lands one finished unit on the program's integration branch: merges it,
// fixes line endings, runs the commit tier, commits, runs the merge tier, and
// records the landing in the program's store.
//
//   node .tangela/scripts/land.mjs <unit> [--no-review-gate]
//
// Run it from the integration branch's checkout with a clean tree. The unit
// must be "reported" in units.tsv unless --no-review-gate is given, and no
// pending mark may still name it. Anything that fails before the commit
// leaves the integration branch as it was. Exit codes: 0 landed, 1 conflict
// or failure, 2 refused (setup, branch, tree or unit state), 3 the merge
// tier's failures passed when rerun alone (load).

import { parseArgs } from "node:util";
import { checkFiles } from "./checks/eol-bom.mjs";
import { findMarks } from "./checks/pending-marks.mjs";
import { gate } from "./gate.mjs";
import { ContractError, readContract, repoRoot } from "./lib/contract.mjs";
import { git } from "./lib/git.mjs";
import { isMain } from "./lib/main.mjs";
import { logDecision, readTable, requireProgram, setUnit } from "./lib/store.mjs";

const EXIT = { DONE: 0, CONFLICT: 1, FAIL: 1, REFUSED: 2, LOAD: 3 };

export async function land({ cwd = process.cwd(), unit, reviewGate = true, say = console.log }) {
  const root = repoRoot(cwd);
  const contract = readContract(root);
  const program = requireProgram(root);
  const finish = (verdict, detail) => {
    say(`LAND ${verdict} ${detail}`);
    return { verdict, detail };
  };

  const current = git(["branch", "--show-current"], { cwd: root });
  if (!program.branch) return finish("REFUSED", "the program has no integration branch; set one with program.mjs branch");
  if (current !== program.branch) return finish("REFUSED", `this checkout is on ${current || "a detached HEAD"}, not ${program.branch}`);
  if (git(["status", "--porcelain"], { cwd: root }) !== "") return finish("REFUSED", "the working tree has uncommitted changes");

  const row = readTable(program.store, "units.tsv").find((candidate) => candidate.id === unit);
  if (!row) return finish("REFUSED", `there is no unit "${unit}" in units.tsv`);
  if (reviewGate && row.state !== "reported") {
    return finish("REFUSED", `${unit} is ${row.state}, not reported; pass --no-review-gate to land it anyway`);
  }
  const branch = row.branch || (contract.worktree.branch ?? "tangela/{unit}").replaceAll("{unit}", unit);
  if (git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root, allowFail: true }) === null) {
    return finish("REFUSED", `there is no branch ${branch}`);
  }

  const before = git(["rev-parse", "HEAD"], { cwd: root });
  say(`land ${unit} from ${branch} onto ${program.branch} at ${before.slice(0, 12)}`);
  if (git(["merge", "--no-ff", "--no-commit", branch], { cwd: root, allowFail: true }) === null) {
    const conflicts = git(["diff", "--name-only", "--diff-filter=U"], { cwd: root }).split("\n").filter(Boolean);
    git(["merge", "--abort"], { cwd: root, allowFail: true });
    return finish("CONFLICT", conflicts.join(" ") || "git refused the merge");
  }
  if (git(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { cwd: root, allowFail: true }) === null) {
    return finish("REFUSED", `${branch} has nothing that ${program.branch} doesn't already have`);
  }
  const abort = (verdict, detail) => {
    git(["merge", "--abort"], { cwd: root });
    say(`${program.branch} is back at ${before.slice(0, 12)}`);
    return finish(verdict, detail);
  };

  const merged = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], { cwd: root }).split("\0").filter(Boolean);
  if (merged.length) {
    const { failed } = checkFiles({ cwd: root, files: merged, fix: true, say: (line) => say(`  ${line}`) });
    if (failed) git(["add", "-u"], { cwd: root });
  }

  if (contract.marks) {
    const pending = findMarks(root, contract.marks).filter((mark) => mark.unit === unit);
    for (const mark of pending) say(`  pending mark at ${mark.file}:${mark.line}`);
    if (pending.length) return abort("FAIL", `${pending.length} pending marks still name ${unit}`);
  }

  if (contract.tiers.commit) {
    const { verdict } = await gate({ cwd: root, tier: "commit", say: (line) => say(`  ${line}`) });
    if (verdict !== "PASS") return abort(verdict === "LOAD" ? "LOAD" : "FAIL", `the commit tier's verdict is ${verdict}`);
  }

  const message = `Land ${unit}${row.title ? `: ${row.title}` : ""}`;
  if (!commit(root, message, say)) return abort("FAIL", "the commit failed, twice if the hook changed files");
  const sha = git(["rev-parse", "--short", "HEAD"], { cwd: root });

  const undo = `git reset --hard ${before}`;
  let evidence = "the contract has no merge tier";
  if (contract.tiers.merge) {
    const record = await gate({ cwd: root, tier: "merge", say: (line) => say(`  ${line}`) });
    evidence = `merge tier ${record.verdict} at ${record.head.slice(0, 12)}`;
    if (record.verdict !== "PASS") {
      say(`the landing commit ${sha} stays, and nothing is recorded. To undo it: ${undo}`);
      return finish(record.verdict === "LOAD" ? "LOAD" : "FAIL", `the merge tier's verdict is ${record.verdict}`);
    }
  }

  setUnit(program.store, unit, { state: "landed", landed: sha });
  logDecision(program.store, {
    kind: "land",
    ref: unit,
    decision: `landed ${branch} on ${program.branch} as ${sha}`,
    evidence,
    by: "coordinator",
  });
  return finish("DONE", sha);
}

// One retry, when the hook rewrote files and failed so they get staged again.
function commit(root, message, say) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (git(["commit", "-q", "-m", message], { cwd: root, allowFail: true }) !== null) return true;
    if (git(["diff", "--name-only"], { cwd: root }) === "") return false;
    say(`  the commit hook changed files, so they are staged and the commit tried again`);
    git(["add", "-u"], { cwd: root });
  }
  return false;
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { "no-review-gate": { type: "boolean" } } });
  const [unit] = positionals;
  if (!unit) {
    console.error("usage: land.mjs <unit> [--no-review-gate]");
    process.exit(EXIT.REFUSED);
  }
  try {
    const { verdict } = await land({ unit, reviewGate: !values["no-review-gate"] });
    process.exit(EXIT[verdict]);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    console.log(`LAND REFUSED ${error.message}`);
    process.exit(EXIT.REFUSED);
  }
}
