#!/usr/bin/env node
// Fails on byte-order marks, UTF-16, CRLF and mixed line endings in text files.
//
//   node .tangela/scripts/checks/eol-bom.mjs            checks what's staged
//   node .tangela/scripts/checks/eol-bom.mjs <files>    checks these files
//   node .tangela/scripts/checks/eol-bom.mjs --all      checks every tracked file's working copy
//   --fix                                              rewrites the working-tree copies as UTF-8 with LF
//
// CRLF is allowed in files that .gitattributes marks eol=crlf, and in files
// matching the contract's eol.crlf globs. Exit codes: 0 clean, 1 problems.

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { ContractError, readContract, repoRoot } from "../lib/contract.mjs";
import { git } from "../lib/git.mjs";
import { matchesAny } from "../lib/glob.mjs";
import { isMain } from "../lib/main.mjs";

const SNIFF_BYTES = 8000;

const isUtf16 = (buffer) => (buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff);
const hasUtf8Bom = (buffer) => buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

export function inspect(buffer) {
  if (isUtf16(buffer)) return { utf16: true };
  if (buffer.subarray(0, SNIFF_BYTES).includes(0)) return { binary: true };
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== 0x0a) continue;
    if (i > 0 && buffer[i - 1] === 0x0d) crlf++;
    else lf++;
  }
  return { bom: hasUtf8Bom(buffer), crlf, lf };
}

export function problemsIn(found, crlfAllowed) {
  if (found.binary) return [];
  if (found.utf16) return ["is UTF-16; save it as UTF-8"];
  const problems = [];
  if (found.bom) problems.push("starts with a UTF-8 byte-order mark");
  if (found.crlf && found.lf) problems.push(`mixes line endings (${found.crlf} CRLF, ${found.lf} LF)`);
  else if (found.crlf && !crlfAllowed) problems.push(`has CRLF line endings (${found.crlf} lines)`);
  return problems;
}

export function normalise(buffer, crlfAllowed) {
  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.subarray(2).toString("utf16le");
  else if (buffer[0] === 0xfe && buffer[1] === 0xff) text = Buffer.from(buffer.subarray(2)).swap16().toString("utf16le");
  else text = (hasUtf8Bom(buffer) ? buffer.subarray(3) : buffer).toString("utf8");
  text = text.replace(/\r\n/g, "\n");
  if (crlfAllowed) text = text.replace(/\n/g, "\r\n");
  return Buffer.from(text, "utf8");
}

export function checkFiles({ cwd = process.cwd(), files = [], all = false, fix = false, say = console.log }) {
  const root = repoRoot(cwd);
  let crlfGlobs = [];
  try {
    crlfGlobs = readContract(root).eol.crlf;
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
  }

  const staged = !all && files.length === 0;
  const paths = all
    ? splitNul(git(["ls-files", "-z"], { cwd: root })).filter((path) => isFile(join(root, path)))
    : staged
      ? splitNul(git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], { cwd: root }))
      : files.map((file) => posix(relative(root, resolve(cwd, file))));
  const crlfByAttribute = crlfAttributes(root, paths);

  let failed = 0;
  for (const path of paths) {
    const buffer = staged ? git(["show", `:${path}`], { cwd: root, encoding: "buffer" }) : readFileSync(join(root, path));
    const crlfAllowed = crlfByAttribute.has(path) || matchesAny(path, crlfGlobs);
    const problems = problemsIn(inspect(buffer), crlfAllowed);
    if (!problems.length) continue;
    failed++;
    say(`${path}: ${problems.join("; ")}`);
    if (fix) {
      writeFileSync(join(root, path), normalise(readFileSync(join(root, path)), crlfAllowed));
      say(`${path}: fixed${staged ? ", so stage it again" : ""}`);
    }
  }
  say(failed ? `eol-bom: ${failed} of ${paths.length} file(s) had problems` : `eol-bom: ${paths.length} file(s) clean`);
  return { checked: paths.length, failed, staged };
}

// Paths that .gitattributes gives eol=crlf.
function crlfAttributes(root, paths) {
  const crlf = new Set();
  for (let i = 0; i < paths.length; i += 200) {
    const out = git(["check-attr", "-z", "eol", "--", ...paths.slice(i, i + 200)], { cwd: root, allowFail: true });
    const fields = splitNul(out ?? "");
    for (let j = 0; j + 2 < fields.length; j += 3) {
      if (fields[j + 2] === "crlf") crlf.add(fields[j]);
    }
  }
  return crlf;
}

// A tracked path can be deleted from the working tree, or be a submodule.
function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function splitNul(text) {
  return text.split("\0").filter(Boolean);
}

function posix(path) {
  return path.split(sep).join("/");
}

if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { all: { type: "boolean" }, fix: { type: "boolean" } },
  });
  try {
    const { failed, staged } = checkFiles({ files: positionals, all: values.all, fix: values.fix });
    process.exit(failed && (staged || !values.fix) ? 1 : 0);
  } catch (error) {
    console.error(`eol-bom: ${error.message}`);
    process.exit(1);
  }
}
