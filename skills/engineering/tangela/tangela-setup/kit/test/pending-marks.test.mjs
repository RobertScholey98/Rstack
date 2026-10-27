import assert from "node:assert/strict";
import { after, test } from "node:test";
import { setUnit } from "../lib/store.mjs";
import { cleanUp, contract, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

const MARKS = { pattern: "pending\\(([a-z0-9-]+)\\)", paths: ["src/**"] };

function withProgram(files, units) {
  const root = repo(files);
  const store = tempDir();
  write(root, { ".tangela/program.json": JSON.stringify({ name: "p", store, branch: null }) });
  for (const [id, fields] of Object.entries(units)) setUnit(store, id, fields);
  return root;
}

test("marks naming units still to land are clean", () => {
  const root = withProgram(
    { "docs/agents/tangela.md": contract({ marks: MARKS }), "src/a.test.js": "it.skip('x') // pending(fix-dates)\n" },
    { "fix-dates": { state: "running" } },
  );
  const { code, out } = runKit("checks/pending-marks.mjs", [], { cwd: root });
  assert.equal(code, 0, out);
  assert.equal(out.trim(), "MARKS OK 1 pending");
});

test("a mark naming a landed unit or an unknown unit fails with its file and line", () => {
  const root = withProgram(
    {
      "docs/agents/tangela.md": contract({ marks: MARKS }),
      "src/a.test.js": "ok\n// pending(fix-dates)\n// pending(no-such-unit)\n",
      "notes/outside.md": "pending(no-such-unit) is outside the paths\n",
    },
    { "fix-dates": { state: "landed", landed: "abc1234" } },
  );
  const { code, out } = runKit("checks/pending-marks.mjs", [], { cwd: root });
  assert.equal(code, 1, out);
  assert.equal(
    out.trim(),
    [
      "src/a.test.js:2: names fix-dates, which landed at abc1234",
      'src/a.test.js:3: names "no-such-unit", which isn\'t in units.tsv',
      "MARKS PROBLEMS 2 of 2",
    ].join("\n"),
  );
});

test("a contract without marks exits 2", () => {
  const root = withProgram({ "docs/agents/tangela.md": contract({}) }, {});
  const { code, out } = runKit("checks/pending-marks.mjs", [], { cwd: root });
  assert.equal(code, 2, out);
  assert.match(out, /MARKS UNSET The contract has no "marks" field/);
});
