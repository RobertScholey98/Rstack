#!/usr/bin/env node
// The plugin's SessionStart hook. In a repo set up for tangela it prints
// what the session should know before it starts: a warning when the
// installed kit isn't the plugin's version, and, when the checkout belongs to
// a program, the standing orders in full and the status line. Anywhere else
// it prints nothing.
//
//   node hooks/session-start.mjs        (reads the hook's JSON on stdin)
//
// It always exits 0, so it can never stop a session from starting.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT_PATH, repoRoot } from "../skills/engineering/tangela/tangela-setup/kit/lib/contract.mjs";
import { isMain } from "../skills/engineering/tangela/tangela-setup/kit/lib/main.mjs";
import { findProgram } from "../skills/engineering/tangela/tangela-setup/kit/lib/store.mjs";

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

export function sessionStart({ cwd, pluginRoot = PLUGIN_ROOT }) {
  let root;
  try {
    root = repoRoot(cwd);
  } catch {
    return [];
  }
  if (!existsSync(join(root, CONTRACT_PATH))) return [];

  const out = [];
  const plugin = readJson(join(pluginRoot, ".claude-plugin", "plugin.json")).version;
  const kitFile = join(root, ".tangela", "scripts", "kit.json");
  const kit = existsSync(kitFile) ? readJson(kitFile).version : null;
  if (kit !== plugin) {
    const installed = kit ? `is version ${kit}` : "isn't installed in this checkout";
    out.push(`tangela: the kit ${installed}, and the plugin is version ${plugin}. Tell the user to run /tangela-setup to install it.`);
  }

  const program = findProgram(root);
  if (program) {
    const orders = join(program.store, "orders.md");
    out.push(`tangela: this checkout belongs to the program "${program.name}". Its standing orders, from ${orders}:`);
    out.push("", readFileSync(orders, "utf8").trimEnd(), "");
    out.push(statusLine(root));
  }
  return out;
}

function statusLine(root) {
  const script = join(root, ".tangela", "scripts", "status.mjs");
  if (!existsSync(script)) return "tangela: this kit has no status.mjs, so there is no status line";
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", timeout: 20_000 });
  const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`.split(/\r?\n/).filter((line) => line.trim());
  return lines.at(-1) ?? `tangela: status.mjs printed nothing (exit ${result.status})`;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// The folder the session started in, from the hook's input. Without usable
// input, the folder the hook runs in.
function sessionFolder() {
  try {
    if (!process.stdin.isTTY) return JSON.parse(readFileSync(0, "utf8")).cwd ?? process.cwd();
  } catch {
    // No input, or input that isn't JSON.
  }
  return process.cwd();
}

if (isMain(import.meta.url)) {
  try {
    for (const line of sessionStart({ cwd: sessionFolder() })) console.log(line);
  } catch (error) {
    console.log(`tangela: the session-start hook failed, and the session goes on without it: ${error.message}`);
  }
  process.exit(0);
}
