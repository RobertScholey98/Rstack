---
name: tangela-setup
description: Set a repo up for tangela. Survey how it verifies, write the contract, install the kit and add the guarded commit hook.
disable-model-invocation: true
---

# tangela-setup

Set this repo up so the other tangela skills can run in it. Three things come out:

- the **contract**, `docs/agents/tangela.md`, committed: what each tier runs here, and how a unit's worktree is made;
- the **kit**, copied into the gitignored `.tangela/scripts/`;
- a block in the commit hook that runs the kit's checks where the kit is installed, and skips them where it isn't.

Rerunning is safe. It upgrades the kit and updates the contract in place. If a contract exists, read it first and treat this run as an update: change only what the survey shows has changed.

## 1. Survey

Facts are yours to find, never the user's. Read the repo for:

- **The repo's rules for agents**, in files such as `AGENTS.md` and `CLAUDE.md`. They may forbid running some commands. Don't run those during the survey, and don't put them in a tier without asking the user.
- **The default branch**, from the remote's HEAD.
- **What CI runs**, step by step. It's the most reliable list of how this repo really verifies.
- **The commit hook** as it is today: what it runs, and what manages it. That's a folder named by `core.hooksPath`, a hook manager that generates that folder when dependencies install, or plain `.git/hooks`.
- **The toolchain**: the package manager and its frozen install command, the test runners, any browser or end-to-end suite, and the Node version file.
- **Gitignored files a fresh checkout needs** to build and test, such as local env files. `git status --ignored` lists candidates.
- **The ports** a dev server uses, and how a second copy would avoid them: a port setting, or an offset. An allowlist somewhere (CORS, sign-in redirects) often limits the range.
- **Files that must keep CRLF**, such as Windows scripts, with no `.gitattributes` rule saying so.

## 2. Install

Install dependencies with the frozen install command if this checkout hasn't. Then run the installer that sits beside this file, from the repo root:

```bash
node <the folder holding this SKILL.md>/install-kit.mjs
```

It replaces `.tangela/scripts/`, stamps it with the plugin's version, and adds `.tangela/` to `.gitignore` unless git already ignores it. It leaves the rest of `.tangela/` alone.

Then write `.tangela/machine.md`: what an agent on this machine needs that the repo can't say. How each shell finds the right Node, path-length limits and the settings that got around them, shell quirks, ports other software holds. One fact per line. `worktree.mjs` copies it into every worktree.

## 3. Write the contract

Fill in the template in [CONTRACT.md](CONTRACT.md). Map the commands onto the tiers:

| Tier | Holds |
| --- | --- |
| `commit` | What the hook checks, over the whole tree, so the gate can rerun it. Where the hook only looks at staged files, use the same tool's whole-tree check. |
| `unit` | The checks a worker can afford once per unit: types, lint, unit tests, and end-to-end tests for touched features when the runner can pick them. |
| `widened` | `unit`, plus the full suites that a change to shared code could break. |
| `merge` | Everything CI runs, including the full end-to-end suite. |
| `release` | Checks that only run on the way into the default branch, beyond `merge`. Often there are none: leave the tier out. |

- **Only green steps go in a tier.** The gate stops at the first failing step, so a step already red on the default branch would fail every gate. Run each candidate step there first. Leave a red one out, record it under the contract's known failures with its output, and tell the user it needs fixing before the program relies on it. Never weaken a step to make it pass.
- **Classify failures.** Give each test step a `failures` pattern and a `rerun` command (the kit's [README](kit/README.md) documents every field). Prove each one through the gate: on a throwaway branch, add one failing test, run `node .tangela/scripts/gate.mjs unit`, and check that the gate names the test and reruns it alone. Then delete the test and the branch. A pattern never seen matching a real failure is a guess.
- **Lock** every step that drives a browser or uses a shared server or database: `"lock": true`.
- **Widen** on shared code: the app shell, shared libraries, the package manifest and lockfile, build and test config.

Some calls are the user's: which suites `unit` can afford when the full set is slow, which paths count as shared, which branch programs start from, and any step the repo's agent rules forbid. Ask them with the harness's question tool, one question at a time, with your recommendation first. Decide the rest yourself, and say what you decided in the contract's prose.

## 4. Add the hook block

Add the block in [HOOK.md](HOOK.md) to the end of the repo's pre-commit hook. Keep what the hook already runs: teammates without the kit rely on it, and CI never runs the kit.

## 5. Commit

Commit the contract, the hook change and any `.gitignore` change together, through the hook. Don't push. A worktree starts from a commit, so the proofs below need this one.

## 6. Prove it

- Run `node .tangela/scripts/gate.mjs commit`, then `unit`, with a clean tree. Both should pass.
- Run `node .tangela/scripts/worktree.mjs setup-check`. It should end with `WORKTREE READY`. Run `gate.mjs commit` inside the new worktree, then remove it from this checkout with `node .tangela/scripts/worktree.mjs --remove setup-check`.
- Stage a file with a byte-order mark and try to commit it. The hook should refuse it. Unstage it and delete it.

When a proof shows the contract is wrong, fix it, commit the fix, and run the proofs again.

Then report to the user: the tiers with their commands and timings, the known failures, the decisions you took, and anything you couldn't prove.
