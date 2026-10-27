# The kit lives in a gitignored `.tangela/` folder

tangela's scripts (gate, worktree, land, status and the checks) run inside the repo being untangled. Hooks and agents need a fixed path to call them by, wherever the plugin happens to be installed.

`tangela-setup` copies them into `.tangela/scripts/` and adds `.tangela/` to the repo's `.gitignore`. The folder also holds machine notes, per-unit scratch and gate logs: things that belong to one checkout on one machine.

## Considered

- **Commit the kit.** Reviewable in PRs, and runnable by CI and by teammates without the plugin. But it puts a tool's internals into every repo's history, and each kit upgrade becomes a change to review.
- **Run it from the plugin's install path.** One copy, but the path differs per machine and per harness, so a hook can't name it.

## Consequences

- A fresh worktree has no `.tangela/`. `worktree.mjs` copies it in with the other gitignored files a worktree needs.
- A copy can fall behind the plugin. Each copy carries the plugin version it came from, and `tangela-doctor` flags an old one.
- Teammates without the kit must still be able to commit. A hook that `tangela-setup` adds runs a kit check only when `.tangela/scripts` exists, and otherwise prints one line saying it skipped.
- CI never runs the kit. It runs the repo's own command for each tier, listed in the contract, which is the same command the gate runs.
- What must be shared lives elsewhere. The contract is committed as `docs/agents/tangela.md`. The program store and the e2e lock live at user level, because every worktree is its own checkout.
