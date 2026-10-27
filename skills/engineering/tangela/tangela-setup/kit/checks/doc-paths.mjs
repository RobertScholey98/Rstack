#!/usr/bin/env node
// Finds repo paths named in markdown that don't exist: relative links, and
// inline code that looks like a path (a slash, no spaces, and a top folder
// that exists).
//
//   node .tangela/scripts/checks/doc-paths.mjs              every tracked *.md file
//   node .tangela/scripts/checks/doc-paths.mjs <files>      these files
//
// A link resolves from the file it's in. Inline code may name a path from the
// file or from the repo root. Gitignored paths are skipped, since a checkout
// makes them. Files under the contract's log folder are skipped: landing
// entries are history, and name files that later landings deleted.
// Exit codes: 0 clean, 1 dead paths, 2 not in a git checkout.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { CONTRACT_PATH, readContract, repoRoot } from "../lib/contract.mjs";
import { git } from "../lib/git.mjs";
import { isMain } from "../lib/main.mjs";

const LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const CODE = /`([^`\s]+)`/g;
const PATHLIKE = /^(?:\.{1,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\/?$/;

// The paths one markdown text names, as { line, path, kind }.
export function pathsIn(markdown) {
  const found = [];
  let fenced = false;
  markdown.split(/\r?\n/).forEach((text, i) => {
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced;
    if (fenced) return;
    for (const [, target] of text.matchAll(LINK)) {
      if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) continue;
      const path = decodeURIComponent(target.replace(/[#?].*$/, ""));
      if (path) found.push({ line: i + 1, path, kind: "link" });
    }
    for (const [, code] of text.replace(LINK, "").matchAll(CODE)) {
      if (code.includes("/") && PATHLIKE.test(code) && !code.includes("//")) {
        found.push({ line: i + 1, path: code, kind: "code" });
      }
    }
  });
  return found;
}

export function docPaths({ cwd = process.cwd(), files = [], say = console.log } = {}) {
  const root = repoRoot(cwd);
  const log = logFolder(root);
  const docs = (
    files.length
      ? files.map((file) => relative(root, realpathSync.native(resolve(cwd, file))).split(sep).join("/"))
      : git(["ls-files", "-z", "--", "*.md"], { cwd: root }).split("\0").filter(Boolean)
  ).filter((doc) => !log || !doc.startsWith(log));

  const dead = [];
  for (const doc of docs) {
    const here = dirname(join(root, doc));
    for (const { line, path, kind } of pathsIn(readFileSync(join(root, doc), "utf8"))) {
      const bases = kind === "link" ? [here] : [here, root];
      const candidates = bases.map((base) => resolve(base, path));
      if (candidates.some((candidate) => existsSync(candidate))) continue;
      // Inline code like `and/or` isn't a path; one whose top folder exists is.
      if (kind === "code" && !bases.some((base) => existsSync(resolve(base, topOf(path))))) continue;
      if (candidates.some((candidate) => isIgnored(root, candidate))) continue;
      dead.push({ file: doc, line, path });
      say(`${doc}:${line}: ${path} doesn't exist`);
    }
  }
  say(dead.length ? `DOC-PATHS DEAD ${dead.length}` : `DOC-PATHS OK ${docs.length} files`);
  return { files: docs, dead };
}

// The contract's log folder with a trailing slash, or null without a contract.
function logFolder(root) {
  if (!existsSync(join(root, CONTRACT_PATH))) return null;
  return `${readContract(root).log.replace(/^\.\//, "").replace(/\/+$/, "")}/`;
}

function topOf(path) {
  const parts = path.split("/");
  const first = parts.findIndex((part) => part !== "." && part !== "..");
  return parts.slice(0, first + 1).join("/");
}

function isIgnored(root, path) {
  const inside = relative(root, path);
  if (inside.startsWith("..")) return false;
  return git(["check-ignore", "-q", "--no-index", inside.split(sep).join("/")], { cwd: root, allowFail: true }) !== null;
}

if (isMain(import.meta.url)) {
  try {
    process.exit(docPaths({ files: process.argv.slice(2) }).dead.length ? 1 : 0);
  } catch (error) {
    console.log(`DOC-PATHS BROKEN ${error.message}`);
    process.exit(2);
  }
}
