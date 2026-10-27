# rstack

## 0.1.0

### Minor Changes

- [`6d46de7`](https://github.com/RobertScholey98/Rstack/commit/6d46de75584b31c14a29ffd28587958f8b3c401b) Thanks [@RobertScholey98](https://github.com/RobertScholey98)! - Add eight engineering skills, started from Matt Pocock's: `grill-me`, `grill-with-docs`, `retro`, `grilling`, `domain-modeling`, `codebase-design`, `tdd` and `code-review`. `grilling` now asks one question at a time through the harness's question tool, with a recommended answer first. `code-review` finds a tangela unit's brief as its spec, and no longer needs an issue tracker set up.

- [`3d6fcf3`](https://github.com/RobertScholey98/Rstack/commit/3d6fcf3b34758f6f3c39617ee9672167bb232d74) Thanks [@RobertScholey98](https://github.com/RobertScholey98)! - Add `tangela-setup`, which writes a repo's tangela contract, installs the kit into `.tangela/scripts` and adds a commit hook block that skips itself where the kit is absent. The kit now refuses a tier with no steps.

- [`8a6e519`](https://github.com/RobertScholey98/Rstack/commit/8a6e5194798de83d2e00a7a741e99947ec51e4bc) Thanks [@RobertScholey98](https://github.com/RobertScholey98)! - Add the tangela kit (`gate.mjs`, `worktree.mjs` and the EOL/BOM check, with tests) under `tangela-setup/kit`, and the `tangela-work` and `tangela-verify` skills.

- [`18be5e6`](https://github.com/RobertScholey98/Rstack/commit/18be5e6dbce703d990c13075e89ec6506112c9cc) Thanks [@RobertScholey98](https://github.com/RobertScholey98)! - Finish the tangela lifecycle. New skills:

  - `tangela`, the router;
  - `tangela-investigate`, which runs the baseline and the sweep that start a program;
  - `tangela-decide`, `tangela-encode`, `tangela-plan`, `tangela-coordinate`, `tangela-land`, `tangela-close` and `tangela-doctor`.

  Also new:

  - eight `principle-*` leaves;
  - the `tangela-worker`, `tangela-explorer` and `tangela-reviewer` agents;
  - a SessionStart hook that reprints a program's orders and status after a compaction.

  The kit gains `program.mjs`, `status.mjs`, `land.mjs`, `doctor.mjs`, `report-facts.mjs` and `prove-red.mjs`, plus checks for stale pending marks, rules stated twice, and dead doc paths.

### Patch Changes

- [`139ee9f`](https://github.com/RobertScholey98/Rstack/commit/139ee9ffd1bddec56fae2bc8478a7c20a1855c13) Thanks [@RobertScholey98](https://github.com/RobertScholey98)! - Fix `tangela-setup` after a dry run on a large monorepo: commit before proving the worktree, keep steps that are red on the default branch out of the tiers, read the repo's agent rules, cover hook managers that generate their hooks folder, and add `worktree.mjs --remove`. The kit now refuses a Node range in the contract instead of ignoring it.
