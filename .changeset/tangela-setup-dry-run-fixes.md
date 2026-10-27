---
"rstack": patch
---

Fix `tangela-setup` after a dry run on a large monorepo: commit before proving the worktree, keep steps that are red on the default branch out of the tiers, read the repo's agent rules, cover hook managers that generate their hooks folder, and add `worktree.mjs --remove`. The kit now refuses a Node range in the contract instead of ignoring it.
