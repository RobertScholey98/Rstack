import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanUp, contract, git, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

const SCRIPTS = {
  "pass.cjs": "process.exit(0);\n",
  "fail.cjs": 'console.log("FAILED: alpha works\\nFAILED: beta works\\nsome noise");\nprocess.exit(1);\n',
  "alone-pass.cjs": "process.exit(0);\n",
  "alone-fail.cjs": "process.exit(1);\n",
  "say.cjs": "console.log(process.argv[2]);\n",
};
const FAILING = { name: "e2e", run: "node fail.cjs", failures: "^FAILED: (.+)$", repeat: 2 };

function gateIn(root, tier, args = [], home = tempDir()) {
  return { ...runKit("gate.mjs", [tier, ...args], { cwd: root, env: { TANGELA_HOME: home } }), home };
}

function lastGate(root) {
  return JSON.parse(readFileSync(join(root, ".tangela", "logs", "last-gate.json"), "utf8"));
}

test("a passing tier records the commit it gated", () => {
  const root = repo({ ...SCRIPTS, "docs/agents/tangela.md": contract({ tiers: { unit: [{ name: "unit tests", run: "node pass.cjs" }] } }) });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 0, out);
  assert.match(out, /pass {2}unit tests/);
  assert.match(out, /GATE PASS unit at [0-9a-f]{12}/);
  const record = lastGate(root);
  assert.equal(record.verdict, "PASS");
  assert.equal(record.head, git(root, "rev-parse", "HEAD"));
  assert.equal(record.dirty, false);
});

test("a failing step names its failures and skips the steps after it", () => {
  const root = repo({
    ...SCRIPTS,
    "docs/agents/tangela.md": contract({ tiers: { unit: [FAILING, { name: "after", run: "node pass.cjs" }] } }),
  });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 1, out);
  assert.match(out, /FAIL {2}e2e/);
  assert.match(out, /alpha works {2}\(not rerun\)/);
  assert.match(out, /beta works {2}\(not rerun\)/);
  assert.match(out, /skip {2}after/);
  assert.match(out, /GATE FAIL unit/);
  assert.deepEqual(lastGate(root).steps[0].failures, ["alpha works", "beta works"]);
});

test("failures that pass when rerun alone are load", () => {
  const step = { ...FAILING, rerun: "node alone-pass.cjs {test}" };
  const root = repo({ ...SCRIPTS, "docs/agents/tangela.md": contract({ tiers: { unit: [step] } }) });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 3, out);
  assert.match(out, /alpha works {2}\(passed alone 2\/2: load\)/);
  assert.match(out, /GATE LOAD unit/);
  assert.deepEqual(
    lastGate(root).steps[0].reruns.map(({ test, runs, passes }) => ({ test, runs, passes })),
    [
      { test: "alpha works", runs: 2, passes: 2 },
      { test: "beta works", runs: 2, passes: 2 },
    ],
  );
});

test("a failure that fails when rerun alone keeps the gate failed", () => {
  const step = { ...FAILING, rerun: "node alone-fail.cjs {test}" };
  const root = repo({ ...SCRIPTS, "docs/agents/tangela.md": contract({ tiers: { unit: [step] } }) });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 1, out);
  assert.match(out, /alpha works {2}\(failed alone 2\/2: real, or already broken on the base\)/);
});

test("a step with no failure pattern shows the end of its log", () => {
  const root = repo({
    ...SCRIPTS,
    "docs/agents/tangela.md": contract({ tiers: { unit: [{ name: "e2e", run: "node fail.cjs" }] } }),
  });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 1, out);
  assert.match(out, /\| some noise/);
});

test("a unit gate widens when the diff touches a shared path", () => {
  const tiers = {
    unit: [{ name: "touched", run: "node say.cjs touched" }],
    widened: [{ name: "everything", run: "node say.cjs everything" }],
  };
  const root = repo({ ...SCRIPTS, "docs/agents/tangela.md": contract({ tiers, widen: ["src/shared/**"] }) });
  git(root, "switch", "-q", "-c", "unit-branch");

  write(root, { "src/feature/a.js": "export {};\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "feature only");
  const narrow = gateIn(root, "unit");
  assert.equal(narrow.code, 0, narrow.out);
  assert.match(narrow.out, /pass {2}touched/);

  write(root, { "src/shared/b.js": "export {};\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "shared code");
  const wide = gateIn(root, "unit");
  assert.equal(wide.code, 0, wide.out);
  assert.match(wide.out, /widened because it touches src\/shared\/b\.js/);
  assert.match(wide.out, /pass {2}everything/);
  assert.equal(lastGate(root).ranTier, "widened");
});

test("a locked step waits for the e2e lock and gives up at the timeout", () => {
  const root = repo({
    ...SCRIPTS,
    "docs/agents/tangela.md": contract({ tiers: { unit: [{ name: "e2e", run: "node pass.cjs", lock: true }] } }),
  });
  const home = tempDir();
  mkdirSync(join(home, "locks", "e2e"), { recursive: true });
  const owner = { pid: process.pid, repo: "/elsewhere", step: "their e2e", since: new Date().toISOString() };
  writeFileSync(join(home, "locks", "e2e", "owner.json"), JSON.stringify(owner));

  const { code, out } = gateIn(root, "unit", ["--lock-timeout", "0.02"], home);
  assert.equal(code, 1, out);
  assert.match(out, /wait {2}e2e lock, held by "their e2e" in \/elsewhere/);
  assert.match(out, /timed out waiting for the e2e lock/);
  assert.equal(existsSync(join(home, "locks", "e2e", "owner.json")), true);
});

test("a lock left by a process that has died is taken over and released", () => {
  const root = repo({
    ...SCRIPTS,
    "docs/agents/tangela.md": contract({ tiers: { unit: [{ name: "e2e", run: "node pass.cjs", lock: true }] } }),
  });
  const home = tempDir();
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  mkdirSync(join(home, "locks", "e2e"), { recursive: true });
  const owner = { pid: deadPid, repo: "/elsewhere", step: "crashed", since: new Date().toISOString() };
  writeFileSync(join(home, "locks", "e2e", "owner.json"), JSON.stringify(owner));

  const { code, out } = gateIn(root, "unit", [], home);
  assert.equal(code, 0, out);
  assert.equal(existsSync(join(home, "locks", "e2e")), false);
});

test("a node version other than the contract's is named in the verdict", () => {
  const root = repo({
    ...SCRIPTS,
    "docs/agents/tangela.md": contract({ node: "1.0.0", tiers: { unit: [{ name: "a", run: "node pass.cjs" }] } }),
  });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 0, out);
  assert.match(out, /but the contract asks for 1\.0\.0/);
  assert.match(out, /GATE PASS .*\(node v[\d.]+, expected 1\.0\.0\)/);
});

test("a repo without a contract is a setup problem", () => {
  const root = repo({ "a.txt": "a\n" });
  const { code, out } = gateIn(root, "unit");
  assert.equal(code, 2, out);
  assert.match(out, /GATE BROKEN There is no contract at docs\/agents\/tangela\.md/);
});

test("a tier the contract doesn't have is a setup problem", () => {
  const root = repo({ "docs/agents/tangela.md": contract({ tiers: { unit: [{ name: "a", run: "b" }] } }) });
  const { code, out } = gateIn(root, "merge");
  assert.equal(code, 2, out);
  assert.match(out, /The contract has no "merge" tier/);
});
