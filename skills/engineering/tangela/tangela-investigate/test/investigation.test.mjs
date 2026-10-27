import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanUp, git, repo, tempDir, write } from "../../tangela-setup/kit/test/support.mjs";
import { check, coverage, globToRegExp, main, next } from "../investigation.mjs";

after(cleanUp);

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "investigation.mjs");

function progress(base, rows, skip = "") {
  const table = rows.map(([id, slice]) => `| ${id} | ${slice} | pending |`).join("\n");
  return `# Investigation: sweep\n\nKind: sweep\nBase: ${base}\nSkip: ${skip}\n\n## Slices\n\n| ID | Slice | Status |\n| --- | --- | --- |\n${table}\n\nNext: sweep everything\n`;
}

function investigation(files, rows, skip) {
  const root = repo({ "src/a.ts": "a\n", "src/b.ts": "b\n", "src/gen/c.ts": "c\n" });
  const base = git(root, "rev-parse", "HEAD");
  const folder = join(tempDir(), "sweep");
  write(folder, { "progress.md": progress(base, rows, skip), ...files });
  return { root, base, folder };
}

const candidate = (id) => ({ id, title: "t", kind: "bug", severity: "high", evidence: [], why: "w", count: 1 });

function finding(fields = {}) {
  return {
    id: "QA-001",
    title: "Dates crash",
    kind: "bug",
    severity: "high",
    effort: "S",
    evidence: [{ file: "src/a.ts", line: 1, quote: "a" }],
    why: "It throws.",
    question: "Fix it now, later, or skip it?",
    slices: ["S01"],
    ...fields,
  };
}

test("next marks swept, verified and baseline slices, and lists what is left", () => {
  const { folder } = investigation(
    {
      "slices/S01.json": JSON.stringify({ files_read: ["src/a.ts"], candidates: [candidate("S01-01")] }),
      "verify/S01.json": JSON.stringify([{ id: "S01-01", verdict: "confirmed" }]),
      "slices/S02.json": JSON.stringify({ files_read: ["src/b.ts"], candidates: [candidate("S02-01")] }),
      "slices/B1.json": JSON.stringify({ files_read: [], measurements: [], candidates: [candidate("B1-01")] }),
      "slices/X1.json": "not json",
    },
    [["S01", "src/a"], ["S02", "src/b"], ["B1", "versions"], ["X1", "dates"]],
  );
  const result = next(folder);
  assert.deepEqual(result, { code: 1, lines: ["Sweep: X1", "Verify: S02", "NEXT 2 of 4 slices left"] });
  const table = readFileSync(join(folder, "progress.md"), "utf8");
  assert.match(table, /\| S01 \| src\/a \| done \|/);
  assert.match(table, /\| S02 \| src\/b \| swept \|/);
  assert.match(table, /\| B1 \| versions \| done \|/);
  assert.match(table, /\| X1 \| dates \| pending \|/);
});

test("next reports none left once every slice is done", () => {
  const { folder } = investigation(
    { "slices/S01.json": JSON.stringify({ files_read: ["src/a.ts"], candidates: [] }) },
    [["S01", "src/a"]],
  );
  assert.deepEqual(next(folder), { code: 0, lines: ["NEXT NONE 1 slices done"] });
});

test("coverage lists files at the base that no slice read, honouring Skip", () => {
  const { root, folder } = investigation(
    { "slices/S01.json": JSON.stringify({ files_read: ["./src/a.ts"], candidates: [] }) },
    [["S01", "src/a"]],
    "src/gen/**, .gitignore",
  );
  assert.deepEqual(coverage(folder, { cwd: root }), {
    code: 1,
    lines: ["unread src/b.ts", "COVERAGE GAPS 1 unread, 1 of 2 read"],
  });
});

test("coverage is complete when every file was read", () => {
  const { root, folder } = investigation(
    { "slices/S01.json": JSON.stringify({ files_read: ["src/a.ts", "src\\b.ts"], candidates: [] }) },
    [["S01", "src"]],
    "src/gen/**, .gitignore",
  );
  assert.deepEqual(coverage(folder, { cwd: root }), { code: 0, lines: ["COVERAGE COMPLETE 2 of 2 read"] });
});

test("check accepts findings in the fixed shape", () => {
  const { root, folder } = investigation({}, [["S01", "src"]]);
  write(folder, { "findings.json": JSON.stringify([finding(), finding({ id: "QA-002" })]) });
  assert.deepEqual(check(folder, { cwd: root }), { code: 0, lines: ["FINDINGS OK 2"] });
});

test("check names every broken field", () => {
  const { root, base, folder } = investigation({}, [["S01", "src"]]);
  const bad = [
    finding({ id: "QA-001", kind: "style", question: "Fix it" }),
    finding({ id: "QA-001", evidence: [{ file: "src/gone.ts", line: 3, quote: "x" }], slices: ["S09"] }),
    finding({ id: "ZZ-003", severity: "critical", effort: "XL", evidence: [] }),
  ];
  write(folder, { "findings.json": JSON.stringify(bad) });
  assert.deepEqual(check(folder, { cwd: root }), {
    code: 1,
    lines: [
      "QA-001: question must end with a question mark",
      "QA-001: kind must be one of bug, structural, ux, test, tooling, security, performance",
      "QA-001: id is used twice",
      `QA-001: src/gone.ts isn't in the base ${base}`,
      "QA-001: slice S09 isn't in progress.md",
      "ZZ-003: severity must be one of high, medium, low",
      "ZZ-003: effort must be one of S, M, L",
      "ZZ-003: evidence is empty",
      "findings use more than one prefix: QA, ZZ",
      "FINDINGS BAD 9 problems in 3 findings",
    ],
  });
});

test("a folder without progress.md is broken, not empty", () => {
  assert.deepEqual(main(["next", tempDir()]).code, 2);
  assert.match(main(["next", tempDir()]).lines[0], /^NEXT BROKEN .*progress\.md doesn't exist$/);
});

test("globs match like .gitignore paths", () => {
  assert.equal(globToRegExp("src/gen/**").test("src/gen/a/b.ts"), true);
  assert.equal(globToRegExp("**/*.snap").test("a/b/c.snap"), true);
  assert.equal(globToRegExp("**/*.snap").test("c.snap"), true);
  assert.equal(globToRegExp("*.md").test("docs/a.md"), false);
});

test("the CLI prints the verdict last and exits with its code", () => {
  const { root, folder } = investigation({}, [["S01", "src"]]);
  const result = spawnSync(process.execPath, [SCRIPT, "next", folder], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout.trim().split("\n").at(-1), "NEXT 1 of 1 slices left");
});
