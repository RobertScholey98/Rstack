---
name: tangela-investigate
description: Investigate the code to start a tangela program, with a baseline of the stack or a sweep for defects, ending in numbered findings.
disable-model-invocation: true
---

# tangela-investigate

Find out what the code is really like before anyone decides what it should be. Every claim you hand on is measured or quoted from the code at one pinned commit. Docs, memory and estimates are leads to check, never answers: counts taken from them are routinely far off.

There are two kinds of investigation, and they share one folder shape and one output:

| Kind | Answers | Detail |
| --- | --- | --- |
| **baseline** | Where the stack stands against its ecosystem, how many ways each concern is done, which counts become ratchets, which loops are slow, which files are hot. | [BASELINE.md](BASELINE.md) |
| **sweep** | What is wrong: a report-only hunt for defects, slice by slice, every candidate verified by a second agent. | [SWEEP.md](SWEEP.md) |

A program's first investigation is a baseline. Run a sweep after it, or whenever the user asks for one. Each investigation gets its own folder, `<store>/investigations/<name>/`, with `name` such as `baseline` or `sweep-<YYYY-MM>`. It holds `progress.md`, `BRIEF.md`, `slices/`, `verify/` (a sweep), `findings.json`, `baseline.md` (a baseline) and `report.md`.

## 1. Find or start the program

Run `node .tangela/scripts/program.mjs`. If the kit is missing, tell the user to run `/tangela-setup` and stop. On `PROGRAM <name> <store>`, carry on in this checkout.

On `PROGRAM NONE`, ask the user for the program's name with the harness's question tool, offering one taken from the repo and the goal. A program works in a checkout of its **integration branch**, `tangela/<name>`, made from the contract's `defaultBranch`. Make that checkout one of two ways:

- **This checkout**, when its tree is clean: `git switch -c tangela/<name> <default branch>`.
- **Its own worktree**, leaving this checkout as it is: `node .tangela/scripts/worktree.mjs <name>`. It prints the branch it made and ends `WORKTREE READY <path>`. Run everything after this from that path.

Then, in that checkout, run `node .tangela/scripts/program.mjs init <name> --branch <the branch>`. Decide, encode, plan, coordinate, land and close all run from this checkout.

Done when the last line is `PROGRAM <name> <store>` or `PROGRAM READY <store>`, and `git branch --show-current` prints the integration branch.

## 2. Pin the base and read the context

Pick the commit you investigate: the head of the program's integration branch. Every line number you record is a line at that commit, so a later reader can check it while the branch moves on.

Read the repo's steering files (`AGENTS.md`, `CLAUDE.md`, `docs/agents/*.md`), its architecture docs, ADRs, conventions, migration or decision log, and the plans and branches already in flight. A finding that in-flight work already covers is a duplicate; a finding a doc records as known and left is still reported, with the doc cited.

Write `progress.md` with the header lines `Kind: baseline` or `Kind: sweep`, `Base: <full sha>`, and `Skip: <glob>, <glob>`, comma-separated, for generated and vendored code nobody hand-writes, or `Skip: none` when nothing is skipped. Under `## Context read`, list every file and branch you read. Done when `progress.md` names the base and lists the context.

## 3. Slice the work

Write the slice table into `progress.md` (`| ID | Slice | Status |`, every status `pending`) and a `Next:` line, following your kind's file. Slice IDs are `S<nn>` for folders, `T<n>` for tests, `X<n>` for cross-cutting lenses and `B<n>` for baseline measurements. Size each slice so one sub-agent reads every file in it within its budget.

Done when every file at the base outside `Skip` falls in some slice.

## 4. Run the slices

Write the investigation's `BRIEF.md` from [SWEEP-BRIEF.md](SWEEP-BRIEF.md) (a sweep) or from the measurement brief in [BASELINE.md](BASELINE.md) (a baseline). Then start one sub-agent per slice with the tangela-explorer agent, which writes only the output file its prompt names. Give each the same brief plus its slice row and the path it writes, `slices/<ID>.json`. On a harness without that agent, ask in the spawn prompt for opus at low effort, and add "Read `.tangela/machine.md` in the repo root before running a command." The app walk is the one exception: SWEEP.md says how it runs.

Runs get interrupted by usage limits and closed sessions. The progress file makes a restart cheap:

```bash
node <the folder holding this SKILL.md>/investigation.mjs next <investigation folder>
```

It sets each row's status from the files on disk and lists what is left. On any restart, run it first and relaunch only the slices it names, with the same brief. Done when it names no slice under `Sweep:`.

## 5. Close the coverage gaps

```bash
node <the folder holding this SKILL.md>/investigation.mjs coverage <investigation folder>
```

It compares every slice's `files_read` with the files at the base. Read small leftovers yourself; give a large set of unread files its own slice and go back to step 4. Done when it prints `COVERAGE COMPLETE`.

## 6. Merge into findings

A sweep first verifies every candidate, as SWEEP.md says, until `next` prints `NEXT NONE`. Then follow your kind's file to turn the slices into `findings.json`, in the shape [SCHEMA.md](SCHEMA.md) fixes, and check it from the repo root:

```bash
node <the folder holding this SKILL.md>/investigation.mjs check <investigation folder>
```

Done when it prints `FINDINGS OK <n>`.

## 7. Re-check the base, report and log

Run `git log <base>..<branch head>`. For each commit since the base, check the findings whose evidence it touches, and say in `report.md` which are now partly or wholly addressed.

Write `report.md` as your kind's file says. Log it with `node .tangela/scripts/program.mjs log finding <name> "<findings by severity>" --evidence investigations/<name>/findings.json`, which prints `LOGGED finding <name>`. Set the progress file's line to `Next: done`. Done when `report.md` exists and the row is logged.

## Reply

Tell the user, in this order: the kind, the base commit, files read against files at the base, findings by severity, the five findings that cost users most, the path to `report.md`, and anything you could not check. Then the next step: tell the user to run `/tangela-decide`, or `/tangela-investigate` again for a sweep after a baseline.
