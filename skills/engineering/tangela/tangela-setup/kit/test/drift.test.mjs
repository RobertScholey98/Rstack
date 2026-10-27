import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { cleanUp, repo, runKit, tempDir, write } from "./support.mjs";

after(cleanUp);

test("one rule in two steering files is drift, however each is formatted", () => {
  const store = tempDir();
  write(store, { "orders.md": "# Orders, version 1\n\n## Never\n\n- Never push to the remote.\n" });
  const root = repo({
    "AGENTS.md": "# Agents\n\n- **Never** push to the remote\n- Run the tests before you commit.\n",
    "CLAUDE.md": "@AGENTS.md\n\n```sh\n# never push to the remote\n```\n",
    "docs/agents/testing.md": "1. You must run `npm test` only from the root.\n",
    "docs/agents/review.md": "You MUST run npm test only from the root!\n",
  });
  write(root, { ".tangela/program.json": JSON.stringify({ name: "p", store, branch: null }) });

  const { code, out } = runKit("checks/drift.mjs", [], { cwd: root });
  assert.equal(code, 1, out);
  assert.equal(
    out.trim(),
    [
      `AGENTS.md:3 and ${join(store, "orders.md")}:5: never push to the remote`,
      "docs/agents/review.md:1 and docs/agents/testing.md:1: you must run npm test only from the root",
      "DRIFT 2 pairs",
    ].join("\n"),
  );
});

test("named files with no shared rule are clean", () => {
  const root = repo({ "a.md": "Never push.\nAlways rebase onto main first.\n", "b.md": "Always rebase onto the base.\n" });
  const { code, out } = runKit("checks/drift.mjs", ["a.md", "b.md"], { cwd: root });
  assert.equal(code, 0, out);
  assert.equal(out.trim(), "DRIFT NONE in 2 files");
});
