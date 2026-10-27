#!/usr/bin/env node
// Keeps an investigation folder honest: which slices are left, which files no
// slice read, and whether findings.json has the fixed shape.
//
//   node investigation.mjs next <folder>      Updates progress.md's Status column from the files on disk.
//                                             Exit 0 every slice done, 1 slices left, 2 broken.
//   node investigation.mjs coverage <folder>  Compares the files every slice read with the files at the base.
//                                             Exit 0 all read, 1 gaps, 2 broken.
//   node investigation.mjs check <folder>     Checks findings.json against the schema and the base commit.
//                                             Exit 0 valid, 1 problems, 2 broken.
//
// <folder> is <store>/investigations/<name>. The last line is the verdict:
// NEXT ..., COVERAGE ..., FINDINGS ....

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const KINDS = ["bug", "structural", "ux", "test", "tooling", "security", "performance"];
export const SEVERITIES = ["high", "medium", "low"];
export const EFFORTS = ["S", "M", "L"];
export const VERDICTS = ["confirmed", "corrected", "false-positive", "duplicate"];
const SLICE_ID = /^(S\d{2}|T\d+|X\d+|B\d+)$/;
const FINDING_ID = /^([A-Z][A-Z0-9]*)-\d{3}$/;

class Broken extends Error {}

// progress.md's header fields and slice table.
export function readProgress(folder) {
  const file = join(folder, "progress.md");
  if (!existsSync(file)) throw new Broken(`${file} doesn't exist`);
  const text = readFileSync(file, "utf8");
  const field = (name) => new RegExp(`^${name}:[ \\t]*(.*)$`, "m").exec(text)?.[1].trim() ?? "";
  const slices = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 3 && SLICE_ID.test(cells[0])) {
      slices.push({ id: cells[0], slice: cells[1], status: cells[2] });
    }
  }
  if (slices.length === 0) throw new Broken(`${file} has no slice rows`);
  const skip = field("Skip").split(",").map((glob) => glob.trim()).filter(Boolean);
  return { file, text, base: field("Base"), skip, slices };
}

function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// A slice is swept when its JSON lists the files it read. A baseline slice
// (B) is then done. Any other slice is done once every candidate it raised
// has a verdict in verify/<ID>.json.
export function sliceStatus(folder, id) {
  const raw = readJson(join(folder, "slices", `${id}.json`));
  if (!raw || !Array.isArray(raw.files_read) || !Array.isArray(raw.candidates ?? [])) return "pending";
  const candidates = raw.candidates ?? [];
  if (id.startsWith("B") || candidates.length === 0) return "done";
  const verdicts = readJson(join(folder, "verify", `${id}.json`));
  if (!Array.isArray(verdicts)) return "swept";
  const judged = new Set(verdicts.filter((v) => VERDICTS.includes(v?.verdict)).map((v) => v.id));
  return candidates.every((c) => judged.has(c.id)) ? "done" : "swept";
}

export function next(folder) {
  const progress = readProgress(folder);
  let text = progress.text;
  const rows = progress.slices.map((row) => ({ ...row, status: sliceStatus(folder, row.id) }));
  for (const row of rows) {
    const line = new RegExp(`^(\\|\\s*${row.id}\\s*\\|[^|\\n]*\\|)[^|\\n]*(\\|)`, "m");
    text = text.replace(line, `$1 ${row.status} $2`);
  }
  if (text !== progress.text) writeFileSync(progress.file, text);
  const toSweep = rows.filter((row) => row.status === "pending").map((row) => row.id);
  const toVerify = rows.filter((row) => row.status === "swept").map((row) => row.id);
  const lines = [];
  if (toSweep.length) lines.push(`Sweep: ${toSweep.join(" ")}`);
  if (toVerify.length) lines.push(`Verify: ${toVerify.join(" ")}`);
  const left = toSweep.length + toVerify.length;
  lines.push(left ? `NEXT ${left} of ${rows.length} slices left` : `NEXT NONE ${rows.length} slices done`);
  return { code: left ? 1 : 0, lines };
}

export function globToRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      source += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: result.status === 0, out: result.stdout ?? "" };
}

function requireBase(progress, cwd) {
  if (!progress.base) throw new Broken(`${progress.file} has no "Base: <commit>" line`);
  if (!git(cwd, ["cat-file", "-e", `${progress.base}^{commit}`]).ok) {
    throw new Broken(`the base ${progress.base} isn't a commit in this repo`);
  }
}

export function coverage(folder, { cwd = process.cwd() } = {}) {
  const progress = readProgress(folder);
  requireBase(progress, cwd);
  const skip = progress.skip.map(globToRegExp);
  const files = git(cwd, ["ls-tree", "-r", "--name-only", progress.base]).out
    .split("\n")
    .filter((file) => file && !skip.some((glob) => glob.test(file)));
  const read = new Set();
  for (const row of progress.slices) {
    const raw = readJson(join(folder, "slices", `${row.id}.json`));
    for (const file of raw?.files_read ?? []) read.add(String(file).replace(/\\/g, "/").replace(/^\.\//, ""));
  }
  const gaps = files.filter((file) => !read.has(file));
  const lines = gaps.map((file) => `unread ${file}`);
  const covered = files.length - gaps.length;
  lines.push(
    gaps.length
      ? `COVERAGE GAPS ${gaps.length} unread, ${covered} of ${files.length} read`
      : `COVERAGE COMPLETE ${covered} of ${files.length} read`,
  );
  return { code: gaps.length ? 1 : 0, lines };
}

export function check(folder, { cwd = process.cwd() } = {}) {
  const progress = readProgress(folder);
  requireBase(progress, cwd);
  const findings = readJson(join(folder, "findings.json"));
  if (!Array.isArray(findings)) throw new Broken(`${join(folder, "findings.json")} isn't a JSON array`);
  const sliceIds = new Set(progress.slices.map((row) => row.id));
  const problems = [];
  const seen = new Set();
  const prefixes = new Set();
  const nonEmpty = (value) => typeof value === "string" && value.trim() !== "";

  findings.forEach((finding, index) => {
    const at = finding?.id ?? `item ${index}`;
    const say = (message) => problems.push(`${at}: ${message}`);
    const id = FINDING_ID.exec(finding?.id ?? "");
    if (!id) say(`id must look like PREFIX-001`);
    else {
      prefixes.add(id[1]);
      if (seen.has(finding.id)) say("id is used twice");
      seen.add(finding.id);
    }
    for (const key of ["title", "why", "question"]) if (!nonEmpty(finding?.[key])) say(`${key} is empty`);
    if (nonEmpty(finding?.question) && !finding.question.trim().endsWith("?")) say("question must end with a question mark");
    if (!KINDS.includes(finding?.kind)) say(`kind must be one of ${KINDS.join(", ")}`);
    if (!SEVERITIES.includes(finding?.severity)) say(`severity must be one of ${SEVERITIES.join(", ")}`);
    if (!EFFORTS.includes(finding?.effort)) say(`effort must be one of ${EFFORTS.join(", ")}`);
    if (!Array.isArray(finding?.evidence) || finding.evidence.length === 0) say("evidence is empty");
    for (const item of finding?.evidence ?? []) {
      if (!nonEmpty(item?.file) || !Number.isInteger(item?.line) || item.line < 1 || !nonEmpty(item?.quote)) {
        say("each evidence item needs a file, a line from 1 and a quote");
      } else if (!git(cwd, ["cat-file", "-e", `${progress.base}:${item.file}`]).ok) {
        say(`${item.file} isn't in the base ${progress.base}`);
      }
    }
    if (!Array.isArray(finding?.slices) || finding.slices.length === 0) say("slices is empty");
    for (const slice of finding?.slices ?? []) if (!sliceIds.has(slice)) say(`slice ${slice} isn't in progress.md`);
  });
  if (prefixes.size > 1) problems.push(`findings use more than one prefix: ${[...prefixes].join(", ")}`);

  const lines = [...problems];
  lines.push(problems.length ? `FINDINGS BAD ${problems.length} problems in ${findings.length} findings` : `FINDINGS OK ${findings.length}`);
  return { code: problems.length ? 1 : 0, lines };
}

const COMMANDS = { next, coverage, check };

export function main(argv, options) {
  const [command, folder] = argv;
  if (!COMMANDS[command] || !folder) {
    return { code: 2, lines: ["usage: investigation.mjs next|coverage|check <folder>", "INVESTIGATION BROKEN usage"] };
  }
  try {
    return COMMANDS[command](folder, options);
  } catch (error) {
    if (!(error instanceof Broken)) throw error;
    return { code: 2, lines: [`${command.toUpperCase()} BROKEN ${error.message}`] };
  }
}

function isMain(url) {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

if (isMain(import.meta.url)) {
  const { code, lines } = main(process.argv.slice(2));
  console.log(lines.join("\n"));
  process.exitCode = code;
}
