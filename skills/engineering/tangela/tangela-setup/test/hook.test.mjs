import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanUp, git, repo, write } from "../kit/test/support.mjs";

after(cleanUp);

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCK = readFileSync(join(SKILL, "HOOK.md"), "utf8").match(/```sh\n([\s\S]*?)```/)[1];
const BOM = String.fromCharCode(0xfeff);

// A repo whose pre-commit hook is HOOK.md's block, with a file holding a
// byte-order mark staged.
function hooked({ kit }) {
  const root = repo();
  write(root, { ".git/hooks/pre-commit": `#!/bin/sh\n${BLOCK}` });
  chmodSync(join(root, ".git", "hooks", "pre-commit"), 0o755);
  if (kit) spawnSync(process.execPath, [join(SKILL, "install-kit.mjs")], { cwd: root });
  write(root, { "notes.md": `${BOM}notes\n` });
  git(root, "add", "notes.md");
  const result = spawnSync("git", ["commit", "-m", "notes"], { cwd: root, encoding: "utf8" });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test("the hook block refuses a commit the kit's check fails", () => {
  const { code, out } = hooked({ kit: true });
  assert.notEqual(code, 0, out);
  assert.match(out, /notes\.md/);
});

test("the hook block lets a checkout without the kit commit, and says it skipped", () => {
  const { code, out } = hooked({ kit: false });
  assert.equal(code, 0, out);
  assert.match(out, /tangela: no kit in this checkout/);
});
