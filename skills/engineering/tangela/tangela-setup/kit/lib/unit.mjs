import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ContractError } from "./contract.mjs";
import { git } from "./git.mjs";

// The ref a unit's branch started from: the one given, else the one
// worktree.mjs recorded, else the contract's default branch.
export function baseRef(root, contract, base) {
  const file = join(root, ".tangela", "worktree.json");
  const record = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  return { from: base ?? record?.base ?? contract.defaultBranch, unit: record?.unit ?? null };
}

// Where a unit's branch left its base.
export function unitBase(root, contract, base) {
  const { from, unit } = baseRef(root, contract, base);
  const forkPoint = git(["merge-base", "HEAD", from], { cwd: root, allowFail: true });
  if (!forkPoint) throw new ContractError(`git can't find a common ancestor of HEAD and ${from}`);
  return { from, forkPoint, unit };
}
