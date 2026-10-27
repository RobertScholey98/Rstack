import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanUp, contract, repo, runKit } from "./support.mjs";

after(cleanUp);

const README = [
  "# App",
  "",
  "See [the guide](docs/guide.md#start), [gone](docs/old.md) and [the site](https://example.com/x.md).",
  "Code lives in `src/app.js`, not `src/moved.js`. Use `and/or`, `.tangela/scripts/gate.mjs` and `npm test`.",
  "```",
  "cat src/also-gone.js",
  "```",
  "",
].join("\n");

test("dead links and dead paths in inline code are named with their line", () => {
  const root = repo({
    "README.md": README,
    "docs/guide.md": "Back to [the readme](../README.md) and [nowhere](./nowhere.md).\n",
    "src/app.js": "export {};\n",
  });
  const { code, out } = runKit("checks/doc-paths.mjs", [], { cwd: root });
  assert.equal(code, 1, out);
  assert.equal(
    out.trim(),
    [
      "README.md:3: docs/old.md doesn't exist",
      "README.md:4: src/moved.js doesn't exist",
      "docs/guide.md:1: ./nowhere.md doesn't exist",
      "DOC-PATHS DEAD 3",
    ].join("\n"),
  );
});

test("named files whose paths all exist are clean", () => {
  const root = repo({ "docs/guide.md": "Read [the readme](../README.md) and `docs/guide.md`.\n", "README.md": "# App\n" });
  const { code, out } = runKit("checks/doc-paths.mjs", ["docs/guide.md"], { cwd: root });
  assert.equal(code, 0, out);
  assert.equal(out.trim(), "DOC-PATHS OK 1 files");
});

test("files under the contract's log folder are skipped, listed or named", () => {
  const root = repo({
    "docs/agents/tangela.md": contract({ log: "docs/history" }),
    "docs/history/u1.md": "Deleted `src/old.js`.\n",
    "docs/history/deep/u2.md": "Deleted `src/older.js`.\n",
    "docs/notes.md": "Moved `src/gone.js`.\n",
    "src/app.js": "export {};\n",
  });
  const listed = runKit("checks/doc-paths.mjs", [], { cwd: root });
  assert.equal(listed.code, 1, listed.out);
  assert.equal(listed.out.trim(), ["docs/notes.md:1: src/gone.js doesn't exist", "DOC-PATHS DEAD 1"].join("\n"));

  const named = runKit("checks/doc-paths.mjs", ["docs/history/u1.md"], { cwd: root });
  assert.equal(named.code, 0, named.out);
  assert.equal(named.out.trim(), "DOC-PATHS OK 0 files");
});
