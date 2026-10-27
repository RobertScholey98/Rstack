import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { archiveProgram, initProgram, setBranch, setUnitFields } from "../program.mjs";
import { readTable } from "../lib/store.mjs";
import { cleanUp, git, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

const quiet = () => {};
const pointer = (root) => JSON.parse(readFileSync(join(root, ".tangela", "program.json"), "utf8"));

test("init makes the store from the templates and points the checkout at it", () => {
  const root = repo();
  const home = tempDir();
  const { code, out } = runKit("program.mjs", ["init", "tidy-dates"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);

  const store = join(home, "programs", "app", "tidy-dates");
  assert.match(out, /PROGRAM READY .*tidy-dates\n$/);
  assert.deepEqual(pointer(root), { name: "tidy-dates", store, branch: null });
  assert.deepEqual(readdirSync(store).sort(), [
    "attention.md",
    "briefs",
    "decisions.tsv",
    "investigations",
    "orders.md",
    "ratchets.tsv",
    "reports",
    "retros",
    "units.tsv",
  ]);
  const orders = readFileSync(join(store, "orders.md"), "utf8");
  assert.equal(orders.split("\n")[0], "# Orders, version 1");
  assert.match(orders, /^\| second reviewer \| sonnet \| medium \|$/m);
  assert.equal(readFileSync(join(store, "units.tsv"), "utf8"), "id\tstate\ttitle\tbranch\tbase\tdepends\tspend\tlanded\tupdated\n");
  const [note] = readTable(store, "decisions.tsv");
  assert.equal(note.kind, "note");
  assert.equal(note.ref, "tidy-dates");
});

test("a worktree's store is named after the main checkout's folder", () => {
  const root = repo();
  const home = tempDir();
  const elsewhere = join(tempDir(), "unit-one");
  git(root, "worktree", "add", "-q", "-b", "unit-one", elsewhere);

  const { store } = initProgram({ cwd: elsewhere, name: "p", home, say: quiet });
  assert.equal(store, join(home, "programs", "app", "p"));
});

test("init refuses a checkout that already belongs to a program, and an existing store", () => {
  const root = repo();
  const home = tempDir();
  initProgram({ cwd: root, name: "first", home, say: quiet });
  assert.throws(() => initProgram({ cwd: root, name: "second", home, say: quiet }), /already belongs to a program/);

  const other = repo();
  const { code, out } = runKit("program.mjs", ["init", "first"], { cwd: other, env: { TANGELA_HOME: home } });
  assert.equal(code, 1, out);
  assert.match(out, /PROGRAM REFUSED The store .* already exists/);
});

test("init --branch and branch refuse a branch that doesn't exist, and record one that does", () => {
  const root = repo();
  const home = tempDir();
  assert.throws(() => initProgram({ cwd: root, name: "p", branch: "nope", home, say: quiet }), /no local branch nope/);
  assert.equal(existsSync(join(home, "programs")), false);

  initProgram({ cwd: root, name: "p", home, say: quiet });
  git(root, "branch", "program/p");
  const { code, out } = runKit("program.mjs", ["branch", "program/p"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 0, out);
  assert.match(out, /PROGRAM BRANCH program\/p\n$/);
  assert.equal(pointer(root).branch, "program/p");
  assert.throws(() => setBranch({ cwd: root, branch: "gone", say: quiet }), /no local branch gone/);
});

test("with no command it shows the program, or says there is none with exit 2", () => {
  const root = repo();
  const home = tempDir();
  const none = runKit("program.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(none.code, 2, none.out);
  assert.equal(none.out, "PROGRAM NONE\n");

  initProgram({ cwd: root, name: "p", home, say: quiet });
  const shown = runKit("program.mjs", [], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(shown.code, 0, shown.out);
  assert.match(shown.out, /orders {3}version 1\n/);
  assert.match(shown.out, /branch {3}none yet\n/);
  assert.match(shown.out, /PROGRAM p .*p\n$/);
});

test("archive moves the store under archive/ with the date and frees the checkout", () => {
  const root = repo();
  const home = tempDir();
  initProgram({ cwd: root, name: "p", home, say: quiet });

  const target = archiveProgram({ cwd: root, home, date: "2026-10-27", say: quiet });
  assert.equal(target, join(home, "programs", "app", "archive", "p-2026-10-27"));
  assert.equal(existsSync(join(home, "programs", "app", "p")), false);
  assert.equal(existsSync(join(root, ".tangela", "program.json")), false);
  assert.deepEqual(
    readTable(target, "decisions.tsv").map((row) => row.decision.split(" ")[0]),
    ["Started", "Archived"],
  );

  initProgram({ cwd: root, name: "p", home, say: quiet });
  assert.throws(() => archiveProgram({ cwd: root, home, date: "2026-10-27", say: quiet }), /already exists/);
});

test("archive from the only checkout says nothing about other worktrees", () => {
  const root = repo();
  const home = tempDir();
  initProgram({ cwd: root, name: "p", home, say: quiet });

  const lines = [];
  archiveProgram({ cwd: root, home, date: "2026-10-27", say: (line) => lines.push(line) });
  assert.deepEqual(lines, [`PROGRAM ARCHIVED ${join(home, "programs", "app", "archive", "p-2026-10-27")}`]);
});

test("archive names each other worktree that still points at the old store", () => {
  const root = repo();
  const home = tempDir();
  initProgram({ cwd: root, name: "p", home, say: quiet });
  const pointing = join(tempDir(), "pointing");
  const elsewhere = join(tempDir(), "elsewhere");
  git(root, "worktree", "add", "-q", "-b", "u1", pointing);
  git(root, "worktree", "add", "-q", "-b", "u2", elsewhere);
  write(pointing, { ".tangela/program.json": readFileSync(join(root, ".tangela", "program.json"), "utf8") });

  const lines = [];
  archiveProgram({ cwd: root, home, date: "2026-10-27", say: (line) => lines.push(line) });
  assert.deepEqual(lines.slice(0, -1), [
    "These worktrees still point at the old store. Remove them, or delete their .tangela/program.json:",
    `  ${realpathSync.native(pointing)}`,
  ]);
});

test("unit sets a unit's fields, keeping each value on one row", () => {
  const root = repo();
  const home = tempDir();
  const { store } = initProgram({ cwd: root, name: "p", home, say: quiet });

  const { code, out } = runKit("program.mjs", ["unit", "move-auth", "state=briefed", "title=Move auth\tinto one place"], {
    cwd: root,
    env: { TANGELA_HOME: home },
  });
  assert.equal(code, 0, out);
  assert.equal(out, "UNIT move-auth briefed\n");
  setUnitFields({ cwd: root, id: "move-auth", fields: ["state=running", "depends=a b"], say: quiet });

  const [unit] = readTable(store, "units.tsv");
  assert.deepEqual([unit.id, unit.state, unit.title, unit.depends], ["move-auth", "running", "Move auth into one place", "a b"]);
});

test("unit refuses a field that isn't a units.tsv column, and a state that isn't a state", () => {
  const root = repo();
  const home = tempDir();
  const { store } = initProgram({ cwd: root, name: "p", home, say: quiet });

  const { code, out } = runKit("program.mjs", ["unit", "move-auth", "owner=me"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(code, 1, out);
  assert.match(out, /PROGRAM REFUSED "owner=me" isn't <field>=<value> with a field from: state, title, branch, base, depends, spend, landed/);
  assert.throws(() => setUnitFields({ cwd: root, id: "move-auth", fields: ["state=done"], say: quiet }), /isn't a unit state/);
  assert.throws(() => setUnitFields({ cwd: root, id: "Move Auth", fields: [], say: quiet }), /kebab case/);
  assert.deepEqual(readTable(store, "units.tsv"), []);
});

test("log appends one decisions row, and refuses a kind the trail doesn't have", () => {
  const root = repo();
  const home = tempDir();
  const { store } = initProgram({ cwd: root, name: "p", home, say: quiet });

  const { code, out } = runKit(
    "program.mjs",
    ["log", "ruling", "F-007", "include: one date formatter", "--why", "two disagree\ton weekends", "--by", "person"],
    { cwd: root, env: { TANGELA_HOME: home } },
  );
  assert.equal(code, 0, out);
  assert.equal(out, "LOGGED ruling F-007\n");
  const row = readTable(store, "decisions.tsv").at(-1);
  assert.deepEqual(
    [row.kind, row.ref, row.decision, row.why, row.by],
    ["ruling", "F-007", "include: one date formatter", "two disagree on weekends", "person"],
  );

  const refused = runKit("program.mjs", ["log", "verdict", "F-007", "x"], { cwd: root, env: { TANGELA_HOME: home } });
  assert.equal(refused.code, 1);
  assert.match(refused.out, /PROGRAM REFUSED "verdict" isn't a decision kind/);
});
