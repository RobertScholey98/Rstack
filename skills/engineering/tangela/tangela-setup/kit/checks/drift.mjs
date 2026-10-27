#!/usr/bin/env node
// Finds one rule stated in two steering files, where the copies will drift
// apart: a line saying must, never, always, don't or only that appears, once
// normalised, in more than one file.
//
//   node .tangela/scripts/checks/drift.mjs              AGENTS.md, CLAUDE.md, docs/agents/*.md and the program's orders.md
//   node .tangela/scripts/checks/drift.mjs <files>      these files
//
// Exit codes: 0 clean, 1 drift, 2 not in a git checkout.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { repoRoot } from "../lib/contract.mjs";
import { isMain } from "../lib/main.mjs";
import { findProgram } from "../lib/store.mjs";

const NORMATIVE = /\b(must|never|always|don'?t|only)\b/;
const MIN_WORDS = 3;

export function steeringFiles(root) {
  const files = ["AGENTS.md", "CLAUDE.md"].map((file) => join(root, file));
  const agents = join(root, "docs", "agents");
  if (existsSync(agents)) {
    for (const name of readdirSync(agents).sort()) if (name.endsWith(".md")) files.push(join(agents, name));
  }
  const program = findProgram(root);
  if (program) files.push(join(program.store, "orders.md"));
  return files.filter((file) => existsSync(file));
}

// A rule's text with the markdown, case, quotes and punctuation taken away,
// so two copies of it compare equal.
export function normalise(line) {
  return line
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^\s*(?:[-*+>]|#+|\d+[.)])\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .toLowerCase()
    .replace(/[^\w\s'./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
}

export function findDrift(files, name = (file) => file) {
  const seen = new Map();
  for (const file of files) {
    let fenced = false;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((text, i) => {
        if (/^\s*(```|~~~)/.test(text)) fenced = !fenced;
        if (fenced) return;
        const rule = normalise(text);
        if (!NORMATIVE.test(rule) || rule.split(" ").length < MIN_WORDS) return;
        const places = seen.get(rule) ?? [];
        if (!places.some((place) => place.file === name(file))) places.push({ file: name(file), line: i + 1 });
        seen.set(rule, places);
      });
  }
  const pairs = [];
  for (const [rule, places] of seen) {
    for (let a = 0; a < places.length; a++) {
      for (let b = a + 1; b < places.length; b++) pairs.push({ rule, first: places[a], second: places[b] });
    }
  }
  return pairs;
}

export function drift({ cwd = process.cwd(), files = [], say = console.log } = {}) {
  const root = repoRoot(cwd);
  const paths = files.length ? files.map((file) => resolve(cwd, file)) : steeringFiles(root);
  const name = (file) => {
    const inside = relative(root, file);
    return inside.startsWith("..") ? file : inside.split(sep).join("/");
  };
  const pairs = findDrift(paths, name);
  for (const { rule, first, second } of pairs) {
    say(`${first.file}:${first.line} and ${second.file}:${second.line}: ${rule}`);
  }
  say(pairs.length ? `DRIFT ${pairs.length} pairs` : `DRIFT NONE in ${paths.length} files`);
  return { files: paths, pairs };
}

if (isMain(import.meta.url)) {
  try {
    process.exit(drift({ files: process.argv.slice(2) }).pairs.length ? 1 : 0);
  } catch (error) {
    console.log(`DRIFT BROKEN ${error.message}`);
    process.exit(2);
  }
}
