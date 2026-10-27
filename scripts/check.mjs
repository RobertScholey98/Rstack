#!/usr/bin/env node
// Enforces the rules in AGENTS.md that a script can check. Run with
// `npm run check`, which also runs the tests.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_LINES = 100;
const TEXT = /\.(md|json|ya?ml|mjs|js|sh|txt)$/;
const IGNORED = new Set([".git", "node_modules", ".claude"]);
const EM_DASH = String.fromCharCode(0x2014);

export function check(root) {
  const problems = [];
  const report = (file, message) =>
    problems.push(`${posix(relative(root, file)) || "."}: ${message}`);

  const files = walk(root);
  const textFiles = files.filter((f) => TEXT.test(f));
  const pluginPath = join(root, ".claude-plugin", "plugin.json");
  const plugin = readJson(pluginPath, report);
  const pkg = readJson(join(root, "package.json"), report);
  const skills = files
    .filter((f) => basename(f) === "SKILL.md")
    .map((f) => readSkill(root, f, report))
    .filter(Boolean);

  checkUniqueNames(skills, report);
  if (plugin) checkPluginSkills(pluginPath, plugin, skills, report);
  checkReadmes(root, skills, report);
  checkLinks(files.filter((f) => f.endsWith(".md")), report);
  checkEmDashes(textFiles, report);
  if (plugin && pkg && plugin.version !== pkg.version) {
    report(pluginPath, `version ${plugin.version} doesn't match package.json's ${pkg.version}`);
  }
  checkDenylist(root, textFiles, report);

  return { problems, skills };
}

function readSkill(root, file, report) {
  const dir = dirname(file);
  const name = basename(dir);
  const text = readFileSync(file, "utf8");
  const meta = frontmatter(text);
  if (!meta) {
    report(file, "has no frontmatter");
    return null;
  }

  if (meta.name !== name) {
    report(file, `frontmatter name "${meta.name ?? ""}" doesn't match its folder "${name}"`);
  }
  if (!NAME.test(name) || name.length > MAX_NAME) {
    report(file, `folder name "${name}" must be kebab case and at most ${MAX_NAME} characters`);
  }
  if (!meta.description) report(file, "has no description");
  else if (meta.description.length > MAX_DESCRIPTION) {
    report(file, `description is over ${MAX_DESCRIPTION} characters`);
  }
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines > MAX_LINES) report(file, `is ${lines} lines, over the ${MAX_LINES}-line limit`);

  const userInvoked = meta["disable-model-invocation"] === "true";
  const yamlPath = join(dir, "agents", "openai.yaml");
  if (!existsSync(yamlPath)) {
    report(file, "has no agents/openai.yaml beside it");
  } else {
    const yaml = readFileSync(yamlPath, "utf8");
    if (!/^\s+display_name:/m.test(yaml) || !/^\s+short_description:/m.test(yaml)) {
      report(yamlPath, "needs interface.display_name and interface.short_description");
    }
    const codexUserInvoked = /^\s+allow_implicit_invocation:\s*false\s*$/m.test(yaml);
    if (codexUserInvoked !== userInvoked) {
      report(
        yamlPath,
        userInvoked
          ? "SKILL.md is user-invoked, so this needs policy.allow_implicit_invocation: false"
          : "SKILL.md is model-invoked, so this must not set policy.allow_implicit_invocation: false",
      );
    }
  }

  return { name, dir, path: `./${posix(relative(root, dir))}`, userInvoked };
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (pair) meta[pair[1]] = pair[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return meta;
}

function checkUniqueNames(skills, report) {
  const seen = new Map();
  for (const skill of skills) {
    const first = seen.get(skill.name);
    if (first) report(join(skill.dir, "SKILL.md"), `shares its name with ${first.path}`);
    else seen.set(skill.name, skill);
  }
}

function checkPluginSkills(pluginPath, plugin, skills, report) {
  const listed = new Set(plugin.skills ?? []);
  for (const skill of skills) {
    if (!listed.delete(skill.path)) report(pluginPath, `skills is missing ${skill.path}`);
  }
  for (const path of listed) report(pluginPath, `skills lists ${path}, which has no SKILL.md`);
}

function checkReadmes(root, skills, report) {
  const cache = new Map();
  const linksIn = (readme) => {
    if (!cache.has(readme)) {
      if (existsSync(readme)) cache.set(readme, readmeLinks(readme));
      else {
        report(readme, "is missing");
        cache.set(readme, new Map());
      }
    }
    return cache.get(readme);
  };

  for (const skill of skills) {
    const want = skill.userInvoked ? "User-invoked" : "Model-invoked";
    for (const readme of [join(dirname(skill.dir), "README.md"), join(root, "README.md")]) {
      const groups = linksIn(readme).get(join(skill.dir, "SKILL.md"));
      if (!groups) report(readme, `doesn't list ${skill.name}`);
      else if (!groups.includes(want)) report(readme, `lists ${skill.name} outside a ${want} heading`);
    }
  }
}

// Maps each SKILL.md a README links to onto the invocation headings it sits under.
function readmeLinks(readme) {
  const links = new Map();
  let group = null;
  for (const line of stripCode(readFileSync(readme, "utf8")).split("\n")) {
    const heading = /^#+\s+(.*)$/.exec(line);
    if (heading) {
      group = /User-invoked|Model-invoked/.exec(heading[1])?.[0] ?? null;
      continue;
    }
    for (const [, target] of line.matchAll(/\]\(([^)\s]+SKILL\.md)\)/g)) {
      const path = resolve(dirname(readme), target);
      links.set(path, [...(links.get(path) ?? []), group]);
    }
  }
  return links;
}

function checkLinks(markdownFiles, report) {
  for (const file of markdownFiles) {
    for (const [, raw] of stripCode(readFileSync(file, "utf8")).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      const target = decodeURI(raw.split("#")[0]);
      if (!existsSync(resolve(dirname(file), target))) {
        report(file, `links to ${raw}, which doesn't exist`);
      }
    }
  }
}

function checkEmDashes(files, report) {
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes(EM_DASH)) report(file, `line ${i + 1} has an em dash`);
      });
  }
}

function checkDenylist(root, files, report) {
  const list = join(root, ".denylist");
  if (!existsSync(list)) return;
  const terms = readFileSync(list, "utf8")
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter((term) => term && !term.startsWith("#"));
  for (const file of files) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const term of terms) {
      if (text.includes(term.toLowerCase())) report(file, `contains the denylisted term "${term}"`);
    }
  }
}

function readJson(file, report) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    report(file, error.code === "ENOENT" ? "is missing" : `isn't valid JSON (${error.message})`);
    return null;
  }
}

function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function posix(path) {
  return path.split(sep).join("/");
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, skills } = check(root);
  for (const problem of problems) console.error(problem);
  if (problems.length) {
    console.error(`\ncheck: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`check: ok, ${skills.length} skill(s)`);
}
