import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspect, normalise, problemsIn } from "../checks/eol-bom.mjs";
import { cleanUp, git, repo, runKit, write } from "./support.mjs";

after(cleanUp);

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const problems = (buffer, crlfAllowed = false) => problemsIn(inspect(buffer), crlfAllowed);

test("LF text is clean", () => {
  assert.deepEqual(problems(Buffer.from("a\nb\n")), []);
});

test("CRLF is flagged unless allowed", () => {
  assert.deepEqual(problems(Buffer.from("a\r\nb\r\n")), ["has CRLF line endings (2 lines)"]);
  assert.deepEqual(problems(Buffer.from("a\r\nb\r\n"), true), []);
});

test("mixed endings are flagged even where CRLF is allowed", () => {
  assert.deepEqual(problems(Buffer.from("a\r\nb\n"), true), ["mixes line endings (1 CRLF, 1 LF)"]);
});

test("a UTF-8 byte-order mark is flagged", () => {
  assert.deepEqual(problems(Buffer.concat([BOM, Buffer.from("a\n")])), ["starts with a UTF-8 byte-order mark"]);
});

test("UTF-16 is flagged and binary files are skipped", () => {
  assert.deepEqual(problems(Buffer.from([0xff, 0xfe, 0x61, 0x00])), ["is UTF-16; save it as UTF-8"]);
  assert.deepEqual(problems(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a])), []);
});

test("normalising drops the mark and the CRs, and decodes UTF-16", () => {
  assert.equal(normalise(Buffer.concat([BOM, Buffer.from("a\r\nb\r\n")]), false).toString("utf8"), "a\nb\n");
  assert.equal(normalise(Buffer.from("a\r\nb\n"), true).toString("utf8"), "a\r\nb\r\n");
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("hi\r\n", "utf16le")]);
  assert.equal(normalise(utf16, false).toString("utf8"), "hi\n");
});

test("with no files it checks what's staged", () => {
  const root = repo({ "a.txt": "a\n" });
  write(root, { "b.txt": "b\r\n", "c.txt": "c\n" });
  git(root, "add", "b.txt", "c.txt");
  const { code, out } = runKit("checks/eol-bom.mjs", [], { cwd: root });
  assert.equal(code, 1, out);
  assert.match(out, /b\.txt: has CRLF line endings \(1 lines\)/);
  assert.match(out, /1 of 2 file\(s\) had problems/);
});

test("files .gitattributes marks eol=crlf may use CRLF", () => {
  const root = repo({ ".gitattributes": "*.cmd eol=crlf\n" });
  write(root, { "run.cmd": "echo hi\r\n" });
  git(root, "add", "run.cmd");
  const { code, out } = runKit("checks/eol-bom.mjs", [], { cwd: root });
  assert.equal(code, 0, out);
  assert.match(out, /1 file\(s\) clean/);
});

test("--fix rewrites the named files as UTF-8 with LF", () => {
  const root = repo({ "a.txt": "a\n" });
  write(root, { "notes.md": Buffer.concat([BOM, Buffer.from("one\r\ntwo\r\n")]) });
  const { code, out } = runKit("checks/eol-bom.mjs", ["notes.md", "--fix"], { cwd: root });
  assert.equal(code, 0, out);
  assert.match(out, /notes\.md: fixed/);
  assert.equal(readFileSync(join(root, "notes.md"), "utf8"), "one\ntwo\n");
});
