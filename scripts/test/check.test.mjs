import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../check.mjs";

const SKILL_MD = "skills/engineering/grilling/SKILL.md";
const OPENAI_YAML = "skills/engineering/grilling/agents/openai.yaml";
const MODEL_SKILL =
  "---\nname: grilling\ndescription: Interview the user. Use when a plan needs testing.\n---\n\n# Grilling\n";
const USER_SKILL =
  "---\nname: grilling\ndescription: Interview the user.\ndisable-model-invocation: true\n---\n\n# Grilling\n";
const MODEL_YAML = 'interface:\n  display_name: "Grilling"\n  short_description: "Interview the user"\n';
const USER_YAML = `${MODEL_YAML}policy:\n  allow_implicit_invocation: false\n`;

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const readmes = (heading) => ({
  "README.md": `## Engineering\n\n### ${heading}\n\n- **[grilling](./skills/engineering/grilling/SKILL.md)**: Interview.\n`,
  "skills/engineering/README.md": `# Engineering\n\n## ${heading}\n\n- **[grilling](./grilling/SKILL.md)**: Interview.\n`,
});

function problems(overrides = {}) {
  const files = {
    "package.json": JSON.stringify({ version: "1.0.0" }),
    ".claude-plugin/plugin.json": JSON.stringify({
      version: "1.0.0",
      skills: ["./skills/engineering/grilling"],
    }),
    ...readmes("Model-invoked"),
    [SKILL_MD]: MODEL_SKILL,
    [OPENAI_YAML]: MODEL_YAML,
    ...overrides,
  };
  const root = mkdtempSync(join(tmpdir(), "rstack-check-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return check(root).problems;
}

function expectOne(found, pattern) {
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], pattern);
}

test("a repo that follows the rules has no problems", () => {
  assert.deepEqual(problems(), []);
});

test("a user-invoked skill listed under User-invoked has no problems", () => {
  assert.deepEqual(
    problems({ [SKILL_MD]: USER_SKILL, [OPENAI_YAML]: USER_YAML, ...readmes("User-invoked") }),
    [],
  );
});

test("a frontmatter name that differs from its folder", () => {
  expectOne(
    problems({ [SKILL_MD]: MODEL_SKILL.replace("name: grilling", "name: grill") }),
    /SKILL\.md: frontmatter name "grill" doesn't match its folder "grilling"/,
  );
});

test("a skill missing from plugin.json", () => {
  expectOne(
    problems({ ".claude-plugin/plugin.json": JSON.stringify({ version: "1.0.0", skills: [] }) }),
    /plugin\.json: skills is missing \.\/skills\/engineering\/grilling/,
  );
});

test("a user-invoked skill without the Codex policy", () => {
  expectOne(
    problems({ [SKILL_MD]: USER_SKILL, ...readmes("User-invoked") }),
    /openai\.yaml: SKILL\.md is user-invoked, so this needs policy\.allow_implicit_invocation: false/,
  );
});

test("a user-invoked skill listed under Model-invoked, in both READMEs", () => {
  const found = problems({ [SKILL_MD]: USER_SKILL, [OPENAI_YAML]: USER_YAML });
  assert.equal(found.length, 2, found.join("\n"));
  for (const problem of found) assert.match(problem, /lists grilling outside a User-invoked heading/);
});

test("a SKILL.md over 100 lines", () => {
  expectOne(
    problems({ [SKILL_MD]: MODEL_SKILL + "line\n".repeat(100) }),
    /SKILL\.md: is 106 lines, over the 100-line limit/,
  );
});

test("an em dash", () => {
  const emDash = String.fromCharCode(0x2014);
  expectOne(problems({ "notes.md": `one\ntwo ${emDash} three\n` }), /notes\.md: line 2 has an em dash/);
});

test("a link to a file that doesn't exist", () => {
  expectOne(
    problems({ "notes.md": "See [it](./missing.md).\n" }),
    /notes\.md: links to \.\/missing\.md, which doesn't exist/,
  );
});

test("a link inside code is not checked", () => {
  assert.deepEqual(problems({ "notes.md": "Write `[it](./missing.md)` like this.\n" }), []);
});

test("versions out of step", () => {
  expectOne(
    problems({ "package.json": JSON.stringify({ version: "1.1.0" }) }),
    /plugin\.json: version 1\.0\.0 doesn't match package\.json's 1\.1\.0/,
  );
});

test("a denylisted term, matched in any case", () => {
  expectOne(
    problems({ ".denylist": "# private\nAcme\n", "notes.md": "Built at ACME.\n" }),
    /notes\.md: contains the denylisted term "Acme"/,
  );
});

test("this repo has no problems", () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  assert.deepEqual(check(repo).problems, []);
});
