import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.mjs";

export const CONTRACT_PATH = "docs/agents/tangela.md";
export const TIERS = ["commit", "unit", "widened", "merge", "release"];

// A problem with the repo's setup rather than with the code being verified.
export class ContractError extends Error {}

export function repoRoot(cwd = process.cwd()) {
  const root = git(["rev-parse", "--show-toplevel"], { cwd, allowFail: true });
  if (!root) throw new ContractError(`${cwd} is not inside a git checkout`);
  return root;
}

export function readContract(root) {
  const file = join(root, CONTRACT_PATH);
  if (!existsSync(file)) {
    throw new ContractError(`There is no contract at ${CONTRACT_PATH}. Run tangela-setup first.`);
  }
  return parseContract(readFileSync(file, "utf8"));
}

export function parseContract(markdown) {
  const block = /```json tangela\r?\n([\s\S]*?)\r?\n```/.exec(markdown);
  if (!block) throw new ContractError("The contract has no ```json tangela block");

  let contract;
  try {
    contract = JSON.parse(block[1]);
  } catch (error) {
    throw new ContractError(`The contract's json tangela block isn't valid JSON: ${error.message}`);
  }
  if (contract.contract !== 1) {
    throw new ContractError(`The contract is version ${contract.contract}, and this kit reads version 1`);
  }
  for (const [tier, steps] of Object.entries(contract.tiers ?? {})) {
    if (!TIERS.includes(tier)) {
      throw new ContractError(`The contract has a tier "${tier}"; tiers are ${TIERS.join(", ")}`);
    }
    if (!Array.isArray(steps) || steps.some((step) => !step?.name || !step?.run)) {
      throw new ContractError(`tiers.${tier} must be a list of steps, each with a name and a run command`);
    }
  }

  return {
    defaultBranch: "main",
    tiers: {},
    widen: [],
    worktree: {},
    ...contract,
    eol: { crlf: [], ...contract.eol },
  };
}

// The Node version gates should run on: the contract's, else .nvmrc or
// .node-version. Null when nothing says, or when it isn't a version number.
export function expectedNode(root, contract) {
  const candidates = [
    ["the contract", contract.node],
    ...[".nvmrc", ".node-version"].map((file) => {
      const path = join(root, file);
      return [file, existsSync(path) ? readFileSync(path, "utf8") : undefined];
    }),
  ];
  for (const [from, raw] of candidates) {
    if (raw === undefined || raw === null) continue;
    const version = String(raw).trim().replace(/^v/, "");
    return /^\d+(\.\d+){0,2}$/.test(version) ? { version, from } : null;
  }
  return null;
}

// "24" accepts any 24.x, "24.22" any 24.22.x, and "24.22.1" only itself.
export function nodeMatches(expected, actual = process.version.replace(/^v/, "")) {
  if (!expected) return true;
  const wanted = expected.split(".");
  return actual.split(".").slice(0, wanted.length).join(".") === wanted.join(".");
}
