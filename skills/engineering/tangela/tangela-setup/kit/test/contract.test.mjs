import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ContractError, nodeMatches, parseContract } from "../lib/contract.mjs";
import { matchesAny } from "../lib/glob.mjs";
import { KIT, contract } from "./support.mjs";

test("the example contract in the kit's README parses", () => {
  const parsed = parseContract(readFileSync(join(KIT, "README.md"), "utf8"));
  assert.deepEqual(Object.keys(parsed.tiers), ["commit", "unit", "widened", "merge"]);
  assert.equal(parsed.tiers.unit[1].lock, true);
  assert.deepEqual(parsed.worktree.ports, [5173, 5180]);
});

test("a contract fills in its defaults", () => {
  const parsed = parseContract(contract({ tiers: { unit: [{ name: "test", run: "npm test" }] } }));
  assert.equal(parsed.defaultBranch, "main");
  assert.deepEqual(parsed.widen, []);
  assert.deepEqual(parsed.eol, { crlf: [] });
  assert.equal(parsed.tiers.unit[0].run, "npm test");
});

test("a contract without the json tangela block is refused", () => {
  assert.throws(() => parseContract("# Contract\n\n```json\n{}\n```\n"), ContractError);
});

test("an unknown tier is refused", () => {
  assert.throws(() => parseContract(contract({ tiers: { nightly: [{ name: "a", run: "b" }] } })), /tiers are commit/);
});

test("a step without a run command is refused", () => {
  assert.throws(() => parseContract(contract({ tiers: { unit: [{ name: "a" }] } })), /each with a name and a run command/);
});

test("a contract of another version is refused", () => {
  assert.throws(() => parseContract(contract({ contract: 2 })), /reads version 1/);
});

test("node versions match as far as the expected version says", () => {
  assert.equal(nodeMatches("24", "24.22.1"), true);
  assert.equal(nodeMatches("24.22", "24.22.1"), true);
  assert.equal(nodeMatches("24.22.1", "24.22.1"), true);
  assert.equal(nodeMatches("24.21", "24.22.1"), false);
  assert.equal(nodeMatches("22", "24.22.1"), false);
  assert.equal(nodeMatches(undefined, "24.22.1"), true);
});

test("globs read like .gitignore", () => {
  assert.equal(matchesAny("src/app/router.ts", ["src/app/**"]), true);
  assert.equal(matchesAny("src/app/deep/nested.ts", ["src/app/**"]), true);
  assert.equal(matchesAny("src/feature/app.ts", ["src/app/**"]), false);
  assert.equal(matchesAny("vite.config.ts", ["vite.config.*"]), true);
  assert.equal(matchesAny("tools/run.cmd", ["*.cmd"]), true);
  assert.equal(matchesAny("src/a/b.ts", ["src/*.ts"]), false);
  assert.equal(matchesAny("src/x/index.ts", ["src/**/index.ts"]), true);
  assert.equal(matchesAny("src/index.ts", ["src/**/index.ts"]), true);
});
