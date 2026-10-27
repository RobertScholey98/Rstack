import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cleanUp, contract, git, repo, runKit, write } from "./support.mjs";

after(cleanUp);

const WORKTREE = {
  root: "../{unit}",
  copy: [".env.local"],
  install: "node install.cjs",
  ports: [47100, 47110],
};

// A repo with a gitignored .env.local and the kit in place, as setup leaves it.
function project(worktree = WORKTREE) {
  const root = repo(
    {
      "docs/agents/tangela.md": contract({ worktree }),
      "install.cjs": 'require("fs").writeFileSync("installed.txt", "yes");\n',
    },
    [".env.local"],
  );
  write(root, { ".env.local": "API=local\n", ".tangela/scripts/gate.mjs": "// kit\n", ".tangela/logs/old.log": "old\n" });
  return root;
}

const worktreeOf = (root, unit) => join(dirname(root), unit);

test("a unit's worktree gets its branch, files, kit, scratch, port and install", () => {
  const root = project();
  const { code, out } = runKit("worktree.mjs", ["add-login"], { cwd: root });
  assert.equal(code, 0, out);

  const path = worktreeOf(root, "add-login");
  assert.equal(git(path, "branch", "--show-current"), "tangela/add-login");
  assert.equal(git(path, "rev-parse", "HEAD"), git(root, "rev-parse", "main"));
  assert.equal(readFileSync(join(path, ".env.local"), "utf8"), "API=local\n");
  assert.equal(existsSync(join(path, ".tangela", "scripts", "gate.mjs")), true);
  assert.equal(existsSync(join(path, ".tangela", "logs", "old.log")), false);
  assert.equal(existsSync(join(path, ".tangela", "scratch", "add-login")), true);
  assert.equal(readFileSync(join(path, "installed.txt"), "utf8"), "yes");

  const record = JSON.parse(readFileSync(join(path, ".tangela", "worktree.json"), "utf8"));
  assert.equal(record.base, "main");
  assert.equal(record.scratch, ".tangela/scratch/add-login");
  assert.ok(record.port >= 47100 && record.port <= 47110, `port ${record.port}`);
  assert.match(out, new RegExp(`WORKTREE READY .*add-login\\n$`));
});

test("--remove deletes the worktree and a branch with nothing unmerged", () => {
  const root = project();
  runKit("worktree.mjs", ["spike", "--no-install"], { cwd: root });
  write(worktreeOf(root, "spike"), { "node_modules/deep/a/b/c.js": "x\n" });

  const { code, out } = runKit("worktree.mjs", ["--remove", "spike"], { cwd: root });
  assert.equal(code, 0, out);
  assert.equal(existsSync(worktreeOf(root, "spike")), false);
  assert.equal(git(root, "worktree", "list", "--porcelain").match(/^worktree /gm).length, 1);
  assert.equal(git(root, "branch", "--list", "tangela/spike"), "");
  assert.match(out, /WORKTREE REMOVED /);
});

test("--remove keeps a branch that holds unmerged work, and says so", () => {
  const root = project();
  runKit("worktree.mjs", ["half-done", "--no-install"], { cwd: root });
  const path = worktreeOf(root, "half-done");
  write(path, { "work.txt": "work\n" });
  git(path, "add", "work.txt");
  git(path, "commit", "-q", "-m", "work");

  const { code, out } = runKit("worktree.mjs", ["--remove", "half-done"], { cwd: root });
  assert.equal(code, 0, out);
  assert.equal(existsSync(path), false);
  assert.match(git(root, "branch", "--list", "tangela/half-done"), /tangela\/half-done/);
  assert.match(out, /kept tangela\/half-done/);
});

test("--remove of a unit with no worktree changes nothing", () => {
  const root = project();
  const { code, out } = runKit("worktree.mjs", ["--remove", "nothing-here"], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /no worktree on tangela\/nothing-here/);
});

test("a second worktree gets a different port", () => {
  const root = project();
  assert.equal(runKit("worktree.mjs", ["first", "--no-install"], { cwd: root }).code, 0);
  assert.equal(runKit("worktree.mjs", ["second", "--no-install"], { cwd: root }).code, 0);
  const port = (unit) => JSON.parse(readFileSync(join(worktreeOf(root, unit), ".tangela", "worktree.json"), "utf8")).port;
  assert.notEqual(port("first"), port("second"));
});

test("a missing gitignored file is reported, and the worktree is still made", () => {
  const root = project({ ...WORKTREE, copy: [".env.local", "users.json"] });
  const { code, out } = runKit("worktree.mjs", ["needs-users", "--no-install"], { cwd: root });
  assert.equal(code, 1, out);
  assert.match(out, /PROBLEM {3}users\.json isn't in /);
  assert.equal(existsSync(worktreeOf(root, "needs-users")), true);
});

test("--base starts the branch from the program's integration branch", () => {
  const root = project();
  git(root, "switch", "-q", "-c", "program");
  write(root, { "program.txt": "program work\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "program work");
  git(root, "switch", "-q", "main");

  const { code, out } = runKit("worktree.mjs", ["next-unit", "--base", "program", "--no-install"], { cwd: root });
  assert.equal(code, 0, out);
  assert.match(out, /branch {4}tangela\/next-unit, from program\n/);
  assert.equal(existsSync(join(worktreeOf(root, "next-unit"), "program.txt")), true);
});

test("a unit name that isn't kebab case makes no worktree", () => {
  const root = project();
  const { code, out } = runKit("worktree.mjs", ["Add Login"], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /must be lowercase kebab case/);
});
