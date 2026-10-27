import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanUp, contract, git, repo, runKit, write } from "./support.mjs";

after(cleanUp);

const MARKS = { pattern: "pending\\(([a-z0-9-]+)\\)", paths: ["src/**"] };

function commit(root, files, message) {
  write(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
}

// A unit branch off main with two commits, as a worker leaves it.
function unit({ marks } = {}) {
  const root = repo({
    "docs/agents/tangela.md": contract(marks ? { marks } : {}),
    "src/dates.js": "// pending(fix-dates) wrong in leap years\n// pending(other-unit) slow\nexport const x = 1;\n",
  });
  git(root, "switch", "-q", "-c", "tangela/fix-dates");
  write(root, { ".tangela/worktree.json": JSON.stringify({ unit: "fix-dates", base: "main" }) });
  commit(root, { "src/dates.js": "// pending(other-unit) slow\nexport const x = 2;\n" }, "Fix leap years");
  commit(root, { "test/dates.test.js": "test\n", "src/new.js": "new\n" }, "Pin dates | add new");
  return root;
}

test("lists the commits, files and tests since the base, with no gate yet", () => {
  const root = unit();
  const { code, out } = runKit("report-facts.mjs", [], { cwd: root });
  assert.equal(code, 0, out);

  const [first, second] = git(root, "log", "--reverse", "--format=%h", "main..HEAD").split("\n");
  assert.match(out, /^\*\*Gate\*\*: no gate has run in this worktree$/m);
  assert.match(out, new RegExp(`^\\| ${first} \\| Fix leap years \\|$`, "m"));
  assert.match(out, new RegExp(`^\\| ${second} \\| Pin dates \\\\\\| add new \\|$`, "m"));
  assert.match(out, /## Files changed\n\n- changed `src\/dates.js`\n- added `src\/new.js`\n- added `test\/dates.test.js`\n/);
  assert.match(out, /## Tests added or changed\n\n- added `test\/dates.test.js`\n/);
  assert.doesNotMatch(out, /Pending marks/);
  assert.equal(out.trimEnd().split("\n").at(-1), "FACTS 2 commits");
});

test("reports the marks the unit flipped and the ones still pending for it", () => {
  const root = unit({ marks: MARKS });
  commit(root, { "src/later.js": "// pending(fix-dates) still to do\n" }, "Leave one");

  const { code, out } = runKit("report-facts.mjs", [], { cwd: root });
  assert.equal(code, 0, out);
  assert.match(out, /## Pending marks\n\n- flipped: fix-dates, 1 in `src\/dates.js`\n- still pending for fix-dates: `src\/later.js:1`\n/);
  assert.equal(out.trimEnd().split("\n").at(-1), "FACTS 3 commits");
});

test("a mark that only moved isn't flipped, and one deleted with its file is", () => {
  const root = unit({ marks: MARKS });
  commit(root, { "src/moved.js": "// pending(other-unit) slow\n" }, "Move a mark");
  git(root, "rm", "-q", "src/dates.js");
  git(root, "commit", "-q", "-m", "Delete dates");

  const { out } = runKit("report-facts.mjs", [], { cwd: root });
  assert.match(out, /## Pending marks\n\n- flipped: fix-dates, 1 in `src\/dates.js`\n- still pending for fix-dates: none\n/);
});

test("says whether the last gate gated HEAD", () => {
  const root = unit();
  const head = git(root, "rev-parse", "HEAD");
  const record = { verdict: "PASS", ranTier: "unit", head, dirty: false, ms: 83_000 };
  write(root, { ".tangela/logs/last-gate.json": JSON.stringify(record) });
  assert.match(runKit("report-facts.mjs", [], { cwd: root }).out, new RegExp(`^\\*\\*Gate\\*\\*: GATE PASS unit at ${head.slice(0, 12)} in 1m23s \\(gated HEAD\\)$`, "m"));

  write(root, { ".tangela/logs/last-gate.json": JSON.stringify({ ...record, dirty: true }) });
  assert.match(runKit("report-facts.mjs", [], { cwd: root }).out, /\(it gated HEAD with uncommitted changes; run the gate again on a clean tree\)$/m);

  commit(root, { "src/more.js": "more\n" }, "More");
  assert.match(runKit("report-facts.mjs", [], { cwd: root }).out, /\(it gated [0-9a-f]{12}, not HEAD; run the gate again\)$/m);
});

test("--base overrides the recorded base, and an unknown base is broken", () => {
  const root = unit();
  const { out } = runKit("report-facts.mjs", ["--base", "HEAD~1"], { cwd: root });
  assert.equal(out.trimEnd().split("\n").at(-1), "FACTS 1 commits");

  const broken = runKit("report-facts.mjs", ["--base", "nowhere"], { cwd: root });
  assert.equal(broken.code, 2, broken.out);
  assert.match(broken.out, /^FACTS BROKEN git can't find a common ancestor of HEAD and nowhere/);
});
