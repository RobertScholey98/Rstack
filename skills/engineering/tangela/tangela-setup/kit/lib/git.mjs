import { spawnSync } from "node:child_process";

// Runs git and returns its output: trimmed text, or a Buffer with
// `encoding: "buffer"`. With `allowFail`, a failing command returns null.
export function git(args, { cwd, allowFail = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, { cwd, encoding, maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr).trim()}`);
  }
  return encoding === "buffer" ? result.stdout : result.stdout.trimEnd();
}
