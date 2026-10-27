import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { readTable, setUnit } from "../lib/store.mjs";
import { cleanUp, contract, git, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

const PASS = [{ name: "ok", run: "node pass.cjs" }];
const FAIL = [{ name: "broken", run: "node fail.cjs" }];

// A repo on the integration branch "program", with the unit fix-dates
// committed on its own branch and reported.
function program({ tiers = { commit: PASS, merge: PASS }, marks, unitFiles = { "src/dates.js": "export const d = 2;\n" } } = {}) {
  const root = repo({
    "pass.cjs": "process.exit(0);\n",
    "fail.cjs": "process.exit(1);\n",
    "src/dates.js": "export const d = 1;\n",
    "docs/agents/tangela.md": contract({ tiers, marks }),
  });
  const store = tempDir();
  write(root, { ".tangela/program.json": JSON.stringify({ name: "p", store, branch: "program" }) });
  git(root, "switch", "-q", "-c", "program");
  git(root, "switch", "-q", "-c", "tangela/fix-dates");
  write(root, unitFiles);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "fix dates");
  git(root, "switch", "-q", "program");
  setUnit(store, "fix-dates", { state: "reported", title: "Fix dates", branch: "tangela/fix-dates" });
  return { root, store, home: tempDir() };
}

function landIn({ root, home }, args = ["fix-dates"]) {
  const result = runKit("land.mjs", args, { cwd: root, env: { TANGELA_HOME: home } });
  return { ...result, last: result.out.trim().split("\n").pop() };
}

test("a clean landing merges the unit and records it in the store", () => {
  const setup = program();
  const { code, out, last } = landIn(setup);
  assert.equal(code, 0, out);
  const sha = git(setup.root, "rev-parse", "--short", "HEAD");
  assert.equal(last, `LAND DONE ${sha}`);
  assert.equal(git(setup.root, "log", "-1", "--format=%s"), "Land fix-dates: Fix dates");
  assert.equal(git(setup.root, "rev-parse", "HEAD^2"), git(setup.root, "rev-parse", "tangela/fix-dates"));

  const [unit] = readTable(setup.store, "units.tsv");
  assert.deepEqual([unit.state, unit.landed], ["landed", sha]);
  const [row] = readTable(setup.store, "decisions.tsv");
  assert.deepEqual(
    { kind: row.kind, ref: row.ref, decision: row.decision, by: row.by },
    { kind: "land", ref: "fix-dates", decision: `landed tangela/fix-dates on program as ${sha}`, by: "coordinator" },
  );
  assert.match(row.evidence, /^merge tier PASS at [0-9a-f]{12}$/);
});

test("a conflict aborts the merge and leaves the integration branch untouched", () => {
  const setup = program();
  write(setup.root, { "src/dates.js": "export const d = 3;\n" });
  git(setup.root, "commit", "-q", "-am", "someone else's change");
  const before = git(setup.root, "rev-parse", "HEAD");

  const { code, out, last } = landIn(setup);
  assert.equal(code, 1, out);
  assert.equal(last, "LAND CONFLICT src/dates.js");
  assert.equal(git(setup.root, "rev-parse", "HEAD"), before);
  assert.equal(git(setup.root, "status", "--porcelain"), "");
  assert.equal(existsSync(join(setup.root, ".git", "MERGE_HEAD")), false);
  assert.equal(readTable(setup.store, "units.tsv")[0].state, "reported");
});

test("a failing merge tier keeps the commit, records nothing, and says how to undo it", () => {
  const setup = program({ tiers: { commit: PASS, merge: FAIL } });
  const before = git(setup.root, "rev-parse", "HEAD");

  const { code, out, last } = landIn(setup);
  assert.equal(code, 1, out);
  assert.equal(last, "LAND FAIL the merge tier's verdict is FAIL");
  assert.match(out, new RegExp(`To undo it: git reset --hard ${before}`));
  assert.equal(git(setup.root, "rev-parse", "HEAD^1"), before);
  assert.equal(readTable(setup.store, "units.tsv")[0].state, "reported");
  assert.equal(existsSync(join(setup.store, "decisions.tsv")), false);
});

test("a failing commit tier commits nothing", () => {
  const setup = program({ tiers: { commit: FAIL } });
  const before = git(setup.root, "rev-parse", "HEAD");
  const { code, out, last } = landIn(setup);
  assert.equal(code, 1, out);
  assert.equal(last, "LAND FAIL the commit tier's verdict is FAIL");
  assert.equal(git(setup.root, "rev-parse", "HEAD"), before);
  assert.equal(git(setup.root, "status", "--porcelain"), "");
});

test("a CRLF file and a byte-order mark are normalised on the way in", () => {
  const setup = program({ unitFiles: { "src/notes.md": "﻿one\r\ntwo\r\n" } });
  const { code, out } = landIn(setup);
  assert.equal(code, 0, out);
  assert.match(out, /src\/notes\.md: fixed/);
  assert.equal(git(setup.root, "show", "HEAD:src/notes.md"), "one\ntwo");
  assert.equal(readFileSync(join(setup.root, "src", "notes.md"), "utf8"), "one\ntwo\n");
  assert.equal(git(setup.root, "status", "--porcelain"), "");
});

test("a unit whose pending marks remain doesn't land", () => {
  const marks = { pattern: "pending\\(([a-z0-9-]+)\\)" };
  const setup = program({ marks, unitFiles: { "src/dates.test.js": "it.skip('parses') // pending(fix-dates)\n" } });
  const before = git(setup.root, "rev-parse", "HEAD");
  const { code, out, last } = landIn(setup);
  assert.equal(code, 1, out);
  assert.match(out, /pending mark at src\/dates\.test\.js:1/);
  assert.equal(last, "LAND FAIL 1 pending marks still name fix-dates");
  assert.equal(git(setup.root, "rev-parse", "HEAD"), before);
});

test("a unit that isn't reported is refused unless the review gate is skipped", () => {
  const setup = program();
  setUnit(setup.store, "fix-dates", { state: "running" });
  const refused = landIn(setup);
  assert.equal(refused.code, 2, refused.out);
  assert.equal(refused.last, "LAND REFUSED fix-dates is running, not reported; pass --no-review-gate to land it anyway");

  const landed = landIn(setup, ["fix-dates", "--no-review-gate"]);
  assert.equal(landed.code, 0, landed.out);
  assert.equal(readTable(setup.store, "units.tsv")[0].state, "landed");
});

test("landing from another branch is refused", () => {
  const setup = program();
  git(setup.root, "switch", "-q", "main");
  const { code, out, last } = landIn(setup);
  assert.equal(code, 2, out);
  assert.equal(last, "LAND REFUSED this checkout is on main, not program");
});
