import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { cleanUp, contract, git, repo, runKit, write } from "./support.mjs";

after(cleanUp);

const CHECK = 'node -e "process.exit(require(\'./add.cjs\')(2, 2) === 4 ? 0 : 1)"';

// A unit branch that fixes add.cjs, so the check passes now and failed before.
function fixed() {
  const root = repo({
    "docs/agents/tangela.md": contract({}),
    "add.cjs": "module.exports = (a, b) => a - b;\n",
    "other.cjs": "module.exports = 1;\n",
  });
  git(root, "switch", "-q", "-c", "tangela/fix-add");
  write(root, { "add.cjs": "module.exports = (a, b) => a + b;\n", "other.cjs": "module.exports = 2;\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "Fix add");
  return root;
}

test("a check that fails on the old code is red, and the file is put back", () => {
  const root = fixed();
  const { code, out } = runKit("prove-red.mjs", ["--run", CHECK, "add.cjs"], { cwd: root });
  assert.equal(code, 0, out);
  assert.match(out, /RED PROVEN the command exited 1 on the old code and passes on the new\n$/);
  assert.equal(readFileSync(join(root, "add.cjs"), "utf8"), "module.exports = (a, b) => a + b;\n");
  assert.equal(git(root, "status", "--porcelain"), "");
});

test("a check that passes on the old code is not red", () => {
  const root = fixed();
  const { code, out } = runKit("prove-red.mjs", ["--run", CHECK, "other.cjs", "--base", "main"], { cwd: root });
  assert.equal(code, 1, out);
  assert.match(out, /NOT RED the command passed on the old code/);
  assert.equal(readFileSync(join(root, "other.cjs"), "utf8"), "module.exports = 2;\n");
});

test("refuses a file with uncommitted changes, and leaves it alone", () => {
  const root = fixed();
  write(root, { "add.cjs": "module.exports = (a, b) => a + b + 0;\n" });
  const { code, out } = runKit("prove-red.mjs", ["--run", CHECK, "add.cjs"], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /PROVE RED BROKEN add\.cjs has uncommitted changes/);
  assert.equal(readFileSync(join(root, "add.cjs"), "utf8"), "module.exports = (a, b) => a + b + 0;\n");
});

test("refuses a file that didn't exist at the base", () => {
  const root = fixed();
  write(root, { "new.cjs": "1\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "New");
  const { code, out } = runKit("prove-red.mjs", ["--run", CHECK, "new.cjs"], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /new\.cjs didn't exist at main/);
});

test("refuses a check that already fails on the current code", () => {
  const root = fixed();
  const { code, out } = runKit("prove-red.mjs", ["--run", "node -e \"process.exit(3)\"", "add.cjs"], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /fails on the current code, so a failure on the old code would prove nothing/);
});
