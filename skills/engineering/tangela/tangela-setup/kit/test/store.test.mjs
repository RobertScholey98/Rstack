import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { appendRow, findProgram, logDecision, ordersVersion, readTable, setUnit } from "../lib/store.mjs";
import { cleanUp, tempDir, write } from "./support.mjs";

after(cleanUp);

test("setUnit adds a unit, then changes only the fields it's given", () => {
  const store = tempDir();
  setUnit(store, "move-auth", { title: "Move auth", state: "briefed" });
  setUnit(store, "move-auth", { state: "running", branch: "tangela/move-auth" });

  const [unit] = readTable(store, "units.tsv");
  assert.equal(unit.id, "move-auth");
  assert.equal(unit.title, "Move auth");
  assert.equal(unit.state, "running");
  assert.equal(unit.branch, "tangela/move-auth");
});

test("setUnit refuses a state the lifecycle doesn't have", () => {
  assert.throws(() => setUnit(tempDir(), "x", { state: "done" }), /isn't a unit state/);
});

test("a value with tabs or newlines stays on one row", () => {
  const store = tempDir();
  logDecision(store, { kind: "ruling", decision: "Keep one\tdate\nlibrary", by: "person" });

  const lines = readFileSync(join(store, "decisions.tsv"), "utf8").trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(readTable(store, "decisions.tsv")[0].decision, "Keep one date library");
});

test("appendRow writes the header once", () => {
  const store = tempDir();
  appendRow(store, "ratchets.tsv", { name: "lint warnings", baseline: "40", target: "0", count: "40" });
  appendRow(store, "ratchets.tsv", { name: "files in legacy/", baseline: "12", target: "0", count: "9" });

  const text = readFileSync(join(store, "ratchets.tsv"), "utf8");
  assert.equal(text.split("\n")[0], "name\tbaseline\ttarget\tcount\tmeasured\tcommand");
  assert.deepEqual(readTable(store, "ratchets.tsv").map((row) => row.count), ["40", "9"]);
});

test("ordersVersion reads the number on the first line", () => {
  const store = tempDir();
  write(store, { "orders.md": "# Orders, version 4\n\nNever push.\n" });
  assert.equal(ordersVersion(store), 4);
  assert.equal(ordersVersion(tempDir()), null);
});

test("findProgram is null without a pointer, and refuses one to a missing store", () => {
  const root = tempDir();
  assert.equal(findProgram(root), null);

  write(root, { ".tangela/program.json": JSON.stringify({ name: "p", store: join(root, "gone") }) });
  assert.throws(() => findProgram(root), /doesn't exist/);
});
