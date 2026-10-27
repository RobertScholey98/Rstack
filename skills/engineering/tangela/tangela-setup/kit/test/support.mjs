import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");

const made = [];

export function cleanUp() {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "tangela-kit-"));
  made.push(dir);
  return dir;
}

export function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

export function write(root, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

export function contract(fields) {
  const json = JSON.stringify({ contract: 1, defaultBranch: "main", ...fields }, null, 2);
  return `# Contract\n\n\`\`\`json tangela\n${json}\n\`\`\`\n`;
}

// A git repo on main with one commit holding `files`, and .tangela/ ignored.
export function repo(files = {}, ignore = []) {
  const root = join(tempDir(), "app");
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  for (const [key, value] of [
    ["user.email", "test@example.com"],
    ["user.name", "Test"],
    ["core.autocrlf", "false"],
    ["commit.gpgsign", "false"],
  ]) {
    git(root, "config", key, value);
  }
  write(root, { ".gitignore": [".tangela/", ...ignore].join("\n") + "\n", ...files });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  return root;
}

export function runKit(script, args, { cwd, env = {} }) {
  const result = spawnSync(process.execPath, [join(KIT, script), ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}
