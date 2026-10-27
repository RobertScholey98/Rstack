import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { initProgram } from "../skills/engineering/tangela/tangela-setup/kit/program.mjs";
import { cleanUp, contract, KIT, repo, tempDir, write } from "../skills/engineering/tangela/tangela-setup/kit/test/support.mjs";

after(cleanUp);

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "session-start.mjs");

function plugin(version) {
  const root = tempDir();
  write(root, { ".claude-plugin/plugin.json": JSON.stringify({ name: "rstack", version }) });
  return root;
}

// A repo with a contract and the kit installed at `kitVersion`.
function setUp(kitVersion = "1.2.0") {
  const root = repo({ "docs/agents/tangela.md": contract({}) });
  cpSync(KIT, join(root, ".tangela", "scripts"), { recursive: true });
  write(root, { ".tangela/scripts/kit.json": JSON.stringify({ version: kitVersion }) });
  return root;
}

function runHook(cwd, { pluginRoot = plugin("1.2.0"), env = {}, stdin = JSON.stringify({ cwd }), from = tempDir() } = {}) {
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: from,
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test("prints nothing outside a git checkout or in a repo without a contract", () => {
  assert.deepEqual(runHook(tempDir()), { code: 0, out: "" });
  assert.deepEqual(runHook(repo()), { code: 0, out: "" });
});

test("prints nothing when the kit matches the plugin and there is no program", () => {
  assert.deepEqual(runHook(setUp()), { code: 0, out: "" });
});

test("warns when the kit's version differs from the plugin's, or the kit is missing", () => {
  const { code, out } = runHook(setUp("1.1.0"));
  assert.equal(code, 0);
  assert.equal(out, "tangela: the kit is version 1.1.0, and the plugin is version 1.2.0. Tell the user to run /tangela-setup to install it.\n");

  const bare = repo({ "docs/agents/tangela.md": contract({}) });
  assert.match(runHook(bare).out, /^tangela: the kit isn't installed in this checkout, and the plugin is version 1\.2\.0\./);
});

test("prints the orders in full and the status line when the checkout belongs to a program", () => {
  const root = setUp();
  const home = tempDir();
  initProgram({ cwd: root, name: "tidy", home, say: () => {} });

  const { code, out } = runHook(root, { env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);
  const lines = out.trimEnd().split("\n");
  assert.match(lines[0], /^tangela: this checkout belongs to the program "tidy"\. Its standing orders, from .*orders\.md:$/);
  assert.equal(lines[2], "# Orders, version 1");
  assert.match(out, /\n## Program-specific\n/);
  assert.equal(lines.at(-1), "STATUS 0 units: none; 0 ratchets at target of 0; 0 need a person");
});

test("an error prints one line and still exits 0", () => {
  const root = setUp();
  write(root, { ".tangela/program.json": "{ not json" });
  const { code, out } = runHook(root);
  assert.equal(code, 0);
  assert.match(out, /^tangela: the session-start hook failed, and the session goes on without it: .+\n$/);

});

test("a program whose store has gone is one line, not a crash", () => {
  const root = setUp();
  write(root, { ".tangela/program.json": JSON.stringify({ name: "gone", store: join(tempDir(), "moved") }) });
  const { code, out } = runHook(root);
  assert.equal(code, 0);
  assert.match(out, /^tangela: the session-start hook failed, and the session goes on without it: .*names the store .*, which doesn't exist\n$/);
});

test("without usable input it reads the folder it runs in", () => {
  const root = setUp("1.1.0");
  const { code, out } = runHook(root, { stdin: "not json", from: root });
  assert.equal(code, 0);
  assert.match(out, /^tangela: the kit is version 1\.1\.0/);
});
