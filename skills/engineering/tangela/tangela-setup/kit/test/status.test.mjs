import assert from "node:assert/strict";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { initProgram } from "../program.mjs";
import { appendRow, readTable, setUnit } from "../lib/store.mjs";
import { cleanUp, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

function program() {
  const root = repo({ "a.txt": "x\n", "b.txt": "x\n" });
  const home = tempDir();
  const { store } = initProgram({ cwd: root, name: "p", home, say: () => {} });
  return { root, home, store };
}

test("status counts units by state, ratchets at target, and open attention items", () => {
  const { root, home, store } = program();
  setUnit(store, "move-auth", { state: "landed", title: "Move auth", landed: "abc1234", spend: "300 tokens" });
  setUnit(store, "drop-moment", { state: "running", spend: "150" });
  setUnit(store, "split-api", { state: "planned" });
  appendRow(store, "ratchets.tsv", { name: "lint warnings", baseline: "40", target: "0", count: "12" });
  appendRow(store, "ratchets.tsv", { name: "legacy files", baseline: "5", target: "0", count: "0" });
  appendFileSync(
    join(store, "attention.md"),
    "- [ ] A1: Keep the old date helper? Settle with: keep | drop. Default if unanswered: drop. Raised 2026-10-27 by coordinator.\n" +
      "- [x] A2: Done already. Settled 2026-10-27: yes.\n",
  );
  const orders = readFileSync(join(store, "orders.md"), "utf8").replace("- Budget: <amount> <unit>", "- Budget: 1,000 tokens");
  write(store, { "orders.md": orders });

  const { code, out } = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);
  assert.match(out, /^units {4}3: 1 landed, 1 running, 1 planned$/m);
  assert.match(out, /^ {2}landed {4}move-auth {2}Move auth \(abc1234\)$/m);
  assert.match(out, /^ {2}lint warnings: 12, baseline 40, target 0$/m);
  assert.match(out, /^ {2}- \[ \] A1: Keep the old date helper\?/m);
  assert.doesNotMatch(out, /A2/);
  assert.match(out, /^spend {4}450 of 1000 tokens \(45%\)$/m);
  assert.equal(
    out.trimEnd().split("\n").at(-1),
    "STATUS 3 units: 1 landed, 1 running, 1 planned; 1 ratchets at target of 2; 1 need a person",
  );
});

test("spend at 70% of the budget says to stop launching", () => {
  const { root, home, store } = program();
  setUnit(store, "big", { state: "running", spend: "70" });
  const orders = readFileSync(join(store, "orders.md"), "utf8").replace("- Budget: <amount> <unit>", "- Budget: 100 hours");
  write(store, { "orders.md": orders });

  const { out } = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.match(out, /^spend {4}70 of 100 hours \(70%\), at or past 70%: stop launching$/m);
});

test("the orders' stop line sets where launching stops, and 70% holds when the line is gone", () => {
  const { root, home, store } = program();
  setUnit(store, "big", { state: "running", spend: "50" });
  const template = readFileSync(join(store, "orders.md"), "utf8").replace("- Budget: <amount> <unit>", "- Budget: 100 hours");
  write(store, { "orders.md": template.replace("- Stop launching at: 70%", "- Stop launching at: 50%") });
  const early = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.match(early.out, /^spend {4}50 of 100 hours \(50%\), at or past 50%: stop launching$/m);

  setUnit(store, "big", { spend: "69" });
  write(store, { "orders.md": template.replace("- Stop launching at: 70%\n", "") });
  const under = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.match(under.out, /^spend {4}69 of 100 hours \(69%\)$/m);
  setUnit(store, "big", { spend: "70" });
  const at = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.match(at.out, /^spend {4}70 of 100 hours \(70%\), at or past 70%: stop launching$/m);
});

test("a launched unit with blank spend is unknown, not zero, and the spend line says so", () => {
  const { root, home, store } = program();
  setUnit(store, "known", { state: "landed", spend: "40" });
  setUnit(store, "solo-a", { state: "reported" });
  setUnit(store, "solo-b", { state: "running", spend: " " });
  setUnit(store, "later", { state: "briefed" });
  const orders = readFileSync(join(store, "orders.md"), "utf8").replace("- Budget: <amount> <unit>", "- Budget: 100 hours");
  write(store, { "orders.md": orders });

  const { out } = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.match(out, /^spend {4}40 of 100 hours \(40%\), not counting 2 units with no spend recorded: solo-a, solo-b$/m);
});

test("an empty program says so, and the template's budget placeholder counts as no budget", () => {
  const { root, home } = program();
  const { code, out } = runKit("status.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);
  assert.match(out, /^spend {4}0 spent; the orders set no budget$/m);
  assert.equal(out.trimEnd().split("\n").at(-1), "STATUS 0 units: none; 0 ratchets at target of 0; 0 need a person");
});

test("--measure records each ratchet's count, and flags one above its baseline", () => {
  const { root, home, store } = program();
  appendRow(store, "ratchets.tsv", { name: "txt files", baseline: "1", target: "0", count: "1", command: `node -p "require('fs').readdirSync('.').filter((f) => f.endsWith('.txt')).length"` });

  const { code, out } = runKit("status.mjs", ["--measure", "--write"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);
  assert.equal(readTable(store, "ratchets.tsv")[0].count, "2");
  assert.match(out, /^ {2}txt files: 2, baseline 1, target 0, ABOVE BASELINE, measured \d{4}-\d{2}-\d{2}$/m);
  assert.match(readFileSync(join(store, "status.md"), "utf8"), /^STATUS 0 units: none; 0 ratchets at target of 1; 0 need a person$/m);
});

test("--measure keeps the old count and exits 1 when a command doesn't print one integer", () => {
  const { root, home, store } = program();
  appendRow(store, "ratchets.tsv", { name: "broken", baseline: "3", target: "0", count: "3", command: "echo lots" });

  const { code, out } = runKit("status.mjs", ["--measure"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 1, out);
  assert.equal(readTable(store, "ratchets.tsv")[0].count, "3");
  assert.match(out, /PROBLEM broken: "echo lots" exited 0 and printed "lots", not one integer/);
});

test("a checkout with no program is broken for status", () => {
  const { code, out } = runKit("status.mjs", [], { cwd: repo() });
  assert.equal(code, 2, out);
  assert.match(out, /^STATUS BROKEN This checkout has no \.tangela\/program\.json/);
});
