import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { after, test } from "node:test";
import { concurrency, doctor } from "../doctor.mjs";
import { setUnit } from "../lib/store.mjs";
import { KIT, cleanUp, contract, git, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

const QUIET = { cpu: 10, memory: 40 };
const HOOK = "#!/bin/sh\nnode .tangela/scripts/checks/eol-bom.mjs || exit 1\n";
const ORDERS = "# Orders, version 2\n\n## Concurrency\n\nLaunch while CPU stays under 80% and memory under 90%. Hard ceiling: 2 running workers.\n\n## Budget\n\nStop at 70%.\n";

// A set-up checkout: hook, kit and contract, in a program on "program".
function checkout({ units = {} } = {}) {
  const root = repo({ ".githooks/pre-commit": HOOK, "docs/agents/tangela.md": contract({}) });
  git(root, "config", "core.hooksPath", ".githooks");
  const store = tempDir();
  write(root, {
    ".tangela/scripts/kit.json": '{ "version": "1.4.0" }\n',
    ".tangela/program.json": JSON.stringify({ name: "p", store, branch: "program" }),
  });
  write(store, { "orders.md": ORDERS });
  git(root, "switch", "-q", "-c", "program");
  for (const [id, state] of Object.entries(units)) setUnit(store, id, { state });
  return { root, store };
}

async function run(root, options = {}) {
  const lines = [];
  const result = await doctor({ cwd: root, home: tempDir(), sampleLoad: async () => QUIET, say: (line) => lines.push(line), ...options });
  return { ...result, lines };
}

test("a set-up checkout is ok, one line per check", async () => {
  const { root } = checkout();
  const { verdict, lines } = await run(root);
  assert.equal(verdict, "OK");
  assert.deepEqual(lines.slice(1), [
    "hooks     core.hooksPath .githooks runs the tangela block",
    "kit       version 1.4.0",
    "e2e lock  free",
    "ports     the contract names no port range",
    "branch    program, nothing landed yet",
    "drift     no rule stated twice",
    "load      cpu 10%, memory 40% used",
    "DOCTOR OK",
  ]);
});

test("a missing hook block and a missing kit are problems", async () => {
  const { root } = checkout();
  git(root, "config", "--unset", "core.hooksPath");
  rmSync(join(root, ".tangela", "scripts"), { recursive: true });

  const { verdict, problems, lines } = await run(root);
  assert.equal(verdict, "PROBLEMS");
  assert.equal(problems, 2);
  assert.equal(lines[1], "hooks     PROBLEM core.hooksPath is unset, and .git/hooks has no pre-commit");
  assert.equal(lines[2], "kit       PROBLEM no .tangela/scripts/kit.json; run /tangela-setup");
  assert.equal(lines.at(-1), "DOCTOR PROBLEMS 2");
});

// Commits past the checkout's hook, whose kit these tests don't install.
function commit(root, message, files) {
  write(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "--no-verify", "-m", message);
  return git(root, "rev-parse", "--short", "HEAD");
}

test("commits no unit made and drift are notes, and the doctor stays ok", async () => {
  const { root, store } = checkout();
  setUnit(store, "a", { state: "landed", landed: commit(root, "a unit's work", { "src/a.js": "1\n" }) });
  commit(root, "log a", { "docs/tangela/log/a.md": "landed\n" });
  const first = commit(root, "a hand edit", { "src/b.js": "1\n" });
  const second = commit(root, "steering", { "AGENTS.md": "- Never push to main.\n", "CLAUDE.md": "Never push to main.\n" });

  const { verdict, problems, lines } = await run(root);
  assert.equal(lines[5], `branch    NOTE program has 2 commits since the last landing that no unit made: ${second} steering; ${first} a hand edit`);
  assert.equal(lines[6], "drift     NOTE 1 rules stated in two files; run checks/drift.mjs");
  assert.equal(problems, 0);
  assert.equal(verdict, "OK");
  assert.equal(lines.at(-1), "DOCTOR OK");
});

test("a husky layout's block, in the script above the hooks folder, counts", async () => {
  const shim = '#!/bin/sh\n. "$(dirname "$0")/h"\n';
  const root = repo({ ".husky/pre-commit": HOOK, ".husky/_/pre-commit": shim, "docs/agents/tangela.md": contract({}) });
  git(root, "config", "core.hooksPath", ".husky/_");
  const { lines } = await run(root);
  assert.equal(lines[1], "hooks     the tangela block is in .husky/pre-commit, under core.hooksPath .husky/_");
});

test("a hook manager's config file at the repo root counts, and a block nowhere is a problem", async () => {
  const lefthook = "pre-commit:\n  commands:\n    tangela:\n      run: node .tangela/scripts/checks/eol-bom.mjs\n";
  const root = repo({ "lefthook.yml": lefthook, "docs/agents/tangela.md": contract({}) });
  assert.equal((await run(root)).lines[1], "hooks     the tangela block is in lefthook.yml");

  const bare = repo({ ".husky/pre-commit": "#!/bin/sh\nnpm test\n", ".husky/_/pre-commit": "#!/bin/sh\n", "docs/agents/tangela.md": contract({}) });
  git(bare, "config", "core.hooksPath", ".husky/_");
  assert.equal((await run(bare)).lines[1], "hooks     PROBLEM core.hooksPath .husky/_ has a pre-commit without the tangela block");
});

test("--launch holds when the running units reach the orders' ceiling", async () => {
  const { root } = checkout({ units: { a: "running", b: "running", c: "briefed" } });
  const { verdict, lines } = await run(root, { launch: true });
  assert.equal(verdict, "HOLD");
  assert.equal(lines.at(-2), "launch    2 running of 2; launch under cpu 80% and memory 90%");
  assert.equal(lines.at(-1), "DOCTOR HOLD 2 units running, and the ceiling is 2");
});

test("--launch holds when load is over the orders' threshold, and goes when it isn't", async () => {
  const { root } = checkout({ units: { a: "running" } });
  const busy = await run(root, { launch: true, sampleLoad: async () => ({ cpu: 85, memory: 95 }) });
  assert.equal(busy.verdict, "HOLD");
  assert.equal(busy.lines.at(-1), "DOCTOR HOLD cpu 85% is over 80%; memory 95% is over 90%");

  const calm = await run(root, { launch: true });
  assert.equal(calm.verdict, "OK");
  assert.equal(calm.lines.at(-1), "DOCTOR OK");
});

test("the command exits 3 on hold and 2 without a contract", () => {
  const { root } = checkout({ units: { a: "running", b: "running" } });
  const held = runKit("doctor.mjs", ["--launch"], { cwd: root, env: { TANGELA_HOME: tempDir() } });
  assert.equal(held.code, 3, held.out);
  assert.match(held.out, /DOCTOR HOLD 2 units running, and the ceiling is 2/);

  const broken = runKit("doctor.mjs", [], { cwd: repo({ "a.txt": "a\n" }) });
  assert.equal(broken.code, 2, broken.out);
  assert.equal(broken.out.trim(), "DOCTOR BROKEN There is no contract at docs/agents/tangela.md. Run tangela-setup first.");
});

test("the ports line names who holds each port in the contract's range", async () => {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();
  try {
    const root = repo({ ".githooks/pre-commit": HOOK, "docs/agents/tangela.md": contract({ worktree: { ports: [port, port + 1] } }) });
    write(root, { ".tangela/worktree.json": JSON.stringify({ unit: "fix-dates", port: port + 1 }) });
    const { lines } = await run(root);
    assert.equal(lines[4], `ports     PROBLEM ${port}-${port + 1}: ${port} in use outside any worktree, ${port + 1} fix-dates (not listening), 0 free`);
  } finally {
    server.close();
  }
});

test("the orders template's concurrency lines parse to their defaults, and edits to them count", () => {
  const store = tempDir();
  write(store, { "orders.md": readFileSync(join(KIT, "templates", "orders.md"), "utf8") });
  assert.deepEqual(concurrency(store), { cpu: 75, memory: 85, ceiling: 4 });
  write(store, { "orders.md": ORDERS });
  assert.deepEqual(concurrency(store), { cpu: 80, memory: 90, ceiling: 2 });
});
