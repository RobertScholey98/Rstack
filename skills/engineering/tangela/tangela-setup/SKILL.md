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

- **The default branch**, from the remote's HEAD.
- **What CI runs**, step by step. It's the most reliable list of how this repo really verifies.
- **The commit hook** as it is today: what it runs, and what manages it (a folder named by `core.hooksPath`, a hook manager's config, or plain `.git/hooks`).
- **The toolchain**: the package manager and its frozen install command, the test runners, any browser or end-to-end suite, and the Node version file.
- **Gitignored files a fresh checkout needs** to build and test, such as local env files. `git status --ignored` lists candidates.
- **The ports** a dev server may use. An allowlist somewhere (CORS, sign-in redirects) often limits them.
- **Files that must keep CRLF**, such as Windows scripts, with no `.gitattributes` rule saying so.

## 2. Write the contract

Fill in the template in [CONTRACT.md](CONTRACT.md). Map the commands onto the tiers:

| Tier | Holds |
| --- | --- |
| `commit` | Exactly what the hook already runs, so the gate can rerun it. |
| `unit` | The checks a worker can afford once per unit: types, lint, unit tests, and end-to-end tests for touched features when the runner can pick them. |
| `widened` | `unit`, plus the full suites that a change to shared code could break. |
| `merge` | Everything CI runs, including the full end-to-end suite. |
| `release` | Anything that only runs on the way into the default branch. |

- **Classify failures.** Give each test step a `failures` pattern and a `rerun` command (the kit's [README](kit/README.md) documents every field). Prove each pattern: on a throwaway branch, add one failing test, run the step, check that the pattern names the test, and run the `rerun` command on it. Then delete the test and the branch. A pattern never seen matching a real failure is a guess.
- **Lock** every step that drives a browser or uses a shared server or database: `"lock": true`.
- **Widen** on shared code: the app shell, shared libraries, the package manifest and lockfile, build and test config.

Some calls are the user's: which suites `unit` can afford when the full set is slow, which paths count as shared, and which branch programs start from. Ask them with the harness's question tool, one question at a time, with your recommendation first. Decide the rest yourself, and say what you decided in the contract's prose.

## 3. Install the kit

Run the installer that sits beside this file, from the repo root:

```bash
node <the folder holding this SKILL.md>/install-kit.mjs
```

It replaces `.tangela/scripts/`, stamps it with the plugin's version, and adds `.tangela/` to `.gitignore` unless git already ignores it. It leaves the rest of `.tangela/` alone.

Then write `.tangela/machine.md`: what an agent on this machine needs that the repo can't say. How each shell finds the right Node, shell quirks, ports other software holds, anything else you tripped on during the survey. One fact per line. `worktree.mjs` copies it into every worktree.

## 4. Add the hook block

Add the block in [HOOK.md](HOOK.md) to the end of the repo's pre-commit hook. Keep what the hook already runs: teammates without the kit rely on it, and CI never runs the kit.

## 5. Prove it

- Run `node .tangela/scripts/gate.mjs commit`, then `unit`, on the default branch with a clean tree. A step that fails here fails before any program has touched the code. Check that its command fails when run directly too, then list it under the contract's known failures with the output. Never weaken a step to make it pass.
- Run `node .tangela/scripts/worktree.mjs setup-check`. Check that it reports ready, and that `gate.mjs commit` passes inside the new worktree. Then remove the worktree and delete its branch.
- Stage a file with a byte-order mark and try to commit it. The hook should refuse it. Unstage it and delete it.

## 6. Commit

Commit the contract, the hook change and any `.gitignore` change together, through the hook. Don't push. Then report to the user: the tiers with their commands and timings, the known failures, the decisions you took, and anything you couldn't prove.
