#!/usr/bin/env node
// Copies the kit into a repo's .tangela/scripts and makes sure git ignores
// .tangela/. Safe to rerun: it replaces the scripts and leaves the rest of
// .tangela/ (machine notes, scratch, logs) alone.
//
//   node <this skill's folder>/install-kit.mjs [repo]
//
// Exits 0 when installed, 2 when the target isn't a git checkout.

import { cpSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "./kit/lib/git.mjs";
import { isMain } from "./kit/lib/main.mjs";

const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)));
const KIT = join(HERE, "kit");
const LEFT_BEHIND = new Set(["test"]);

// The version of the plugin this copy of the skill came from, or "unknown"
// when it isn't inside one.
export function pluginVersion(from = HERE) {
  for (let dir = from; ; dir = dirname(dir)) {
    const manifest = join(dir, ".claude-plugin", "plugin.json");
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, "utf8")).version ?? "unknown";
    if (dirname(dir) === dir) return "unknown";
  }
}

export function installKit({ cwd = process.cwd(), version = pluginVersion(), say = console.log } = {}) {
  const root = git(["rev-parse", "--show-toplevel"], { cwd, allowFail: true });
  if (!root) throw new Error(`${resolve(cwd)} isn't inside a git checkout`);

  const target = join(root, ".tangela", "scripts");
  const stampPath = join(target, "kit.json");
  const previous = existsSync(stampPath) ? JSON.parse(readFileSync(stampPath, "utf8")).version : null;

  rmSync(target, { recursive: true, force: true });
  cpSync(KIT, target, {
    recursive: true,
    filter: (source) => !LEFT_BEHIND.has(source.slice(KIT.length + 1).split(/[\\/]/)[0]),
  });
  writeFileSync(stampPath, `${JSON.stringify({ version }, null, 2)}\n`);

  const ignored = git(["check-ignore", "-q", ".tangela/scripts/kit.json"], { cwd: root, allowFail: true }) !== null;
  if (!ignored) {
    const gitignore = join(root, ".gitignore");
    const text = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const gap = text === "" || text.endsWith("\n") ? "" : eol;
    writeFileSync(gitignore, `${text}${gap}.tangela/${eol}`);
  }

  const upgrade = previous && previous !== version ? ` (was ${previous})` : "";
  say(`KIT ${version} installed in .tangela/scripts${upgrade}`);
  say(ignored ? "gitignore: .tangela/ already ignored" : "gitignore: added .tangela/, which needs committing");
  return { root, version, previous, addedIgnore: !ignored };
}

if (isMain(import.meta.url)) {
  try {
    installKit({ cwd: process.argv[2] ?? process.cwd() });
  } catch (error) {
    console.log(`KIT NOT INSTALLED ${error.message}`);
    process.exit(2);
  }
}
