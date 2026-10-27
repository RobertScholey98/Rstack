import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanUp, git, repo, tempDir, write } from "../kit/test/support.mjs";

after(cleanUp);

const INSTALLER = join(dirname(fileURLToPath(import.meta.url)), "..", "install-kit.mjs");

function install(cwd, ...args) {
  const result = spawnSync(process.execPath, [INSTALLER, ...args], { cwd, encoding: "utf8" });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

// A repo whose .gitignore doesn't mention .tangela/ yet.
function bareRepo(gitignore) {
  const root = repo();
  write(root, { ".gitignore": gitignore });
  git(root, "commit", "-qam", "unignore");
  return root;
}

test("the kit goes into .tangela/scripts without its tests, stamped with the plugin version", () => {
  const root = repo();
  const { code, out } = install(root);
  assert.equal(code, 0, out);

  const scripts = join(root, ".tangela", "scripts");
  for (const file of ["gate.mjs", "worktree.mjs", "checks/eol-bom.mjs", "lib/contract.mjs", "README.md"]) {
    assert.equal(existsSync(join(scripts, file)), true, file);
  }
  assert.equal(existsSync(join(scripts, "test")), false);

  const version = JSON.parse(readFileSync(join(scripts, "kit.json"), "utf8")).version;
  const repoRoot = join(dirname(INSTALLER), "..", "..", "..", "..");
  assert.equal(version, JSON.parse(readFileSync(join(repoRoot, ".claude-plugin", "plugin.json"), "utf8")).version);
  assert.match(out, new RegExp(`KIT ${version.replaceAll(".", "\\.")} installed`));
  assert.match(out, /already ignored/);
});

test("the installed gate runs from its new home", () => {
  const root = repo();
  install(root);
  const result = spawnSync(process.execPath, [join(root, ".tangela", "scripts", "gate.mjs"), "unit"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /GATE BROKEN There is no contract at docs\/agents\/tangela\.md/);
});

test(".tangela/ is added to a .gitignore that lacks it, in the file's own line endings", () => {
  const root = bareRepo("dist\r\nnode_modules");
  const { code, out } = install(root);
  assert.equal(code, 0, out);
  assert.equal(readFileSync(join(root, ".gitignore"), "utf8"), "dist\r\nnode_modules\r\n.tangela/\r\n");
  assert.match(out, /added \.tangela\//);
  assert.equal(git(root, "status", "--porcelain"), "M .gitignore");
});

test("rerunning replaces the scripts and keeps machine notes, scratch and logs", () => {
  const root = repo();
  install(root);
  write(root, {
    ".tangela/scripts/stale.mjs": "// from an old kit\n",
    ".tangela/scripts/kit.json": '{ "version": "0.0.0-old" }\n',
    ".tangela/machine.md": "notes\n",
    ".tangela/scratch/unit/a.txt": "a\n",
    ".tangela/logs/last-gate.json": "{}\n",
  });

  const { code, out } = install(root);
  assert.equal(code, 0, out);
  assert.match(out, /\(was 0\.0\.0-old\)/);
  assert.equal(existsSync(join(root, ".tangela", "scripts", "stale.mjs")), false);
  for (const file of ["machine.md", "scratch/unit/a.txt", "logs/last-gate.json"]) {
    assert.equal(existsSync(join(root, ".tangela", file)), true, file);
  }
  assert.equal(readFileSync(join(root, ".gitignore"), "utf8"), ".tangela/\n");
});

test("a folder that isn't a git checkout gets nothing", () => {
  const dir = join(tempDir(), "plain");
  mkdirSync(dir);
  const { code, out } = install(dir);
  assert.equal(code, 2);
  assert.match(out, /KIT NOT INSTALLED/);
  assert.equal(existsSync(join(dir, ".tangela")), false);
});
