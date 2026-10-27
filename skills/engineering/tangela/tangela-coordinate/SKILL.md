---
name: tangela-coordinate
description: Run a tangela program's units, from launch to landing.
disable-model-invocation: true
---

# tangela-coordinate

You run the program; the workers write the code. Each pass of the loop below launches what the machine has room for, drains what came back, and lands what's finished. Every decision you take goes in `decisions.tsv` with its reason, through `node .tangela/scripts/program.mjs log <kind> <ref> "<decision>" --why "<reason>"`.

## Start, and after every compaction

1. Run `node .tangela/scripts/program.mjs` from the integration branch's checkout, where everything below runs. On `PROGRAM NONE`, tell the user to run `/tangela-investigate`.
2. Read the store's `orders.md` in full, even when a hook has just printed it. Its Never section binds you as much as any worker.
3. Run `node .tangela/scripts/status.mjs --write`.

Done when you can state the orders version, the units by state, and spend against the budget. In solo mode (the orders' Program-specific section says which), follow [SOLO.md](SOLO.md) instead of the loop.

## The loop

Steps 1 to 3 repeat until doctor holds or no unit is ready. Then wait for workers. Each worker that finishes starts step 4, and each landing returns you to step 1.

### 1. Check the budget

When spend reaches the orders' stop line, stop launching. Add an `attention.md` item ("Settle with: continue | stop. Default if unanswered: no more launches"), and ask the user with the harness's question tool. Running units still drain and land.

Done when spend is under the stop line, or the item is raised and the question asked.

### 2. Pick the next unit

A unit is ready when it is `briefed` and every unit in its `depends` has landed. Take the first in `units.tsv` order.

**Refresh its brief.** Compare the brief's "Written against" line with the orders version and the newest `ruling`, `default` and `orders` rows in `decisions.tsv`. Other kinds of row leave a brief current. When either is newer, read the brief against the newer rows and the current orders, rewrite each field they change, and restamp it.

**Check it against every running unit.** For each running unit, list the files it has changed (`git diff --name-only <its base>...<its branch>`) and the files its brief owns. Compare them with the files the ready unit's brief names.

- No overlap: launch.
- Overlap: wait for the running unit to land, or fence the ready unit. Fencing adds the running unit's files to the brief's "Leave alone" list, with the owner, and logs `program.mjs log note <unit> "fenced from <running unit>: <files>"`.

Done when the ready unit's brief is current and its files have been checked against every running unit's.

### 3. Launch

Load the "tangela-doctor" skill, and run `node .tangela/scripts/doctor.mjs --launch`. It reads the orders' Concurrency section: the load thresholds, the e2e lock and the worker ceiling.

| Last line | Do |
| --- | --- |
| `DOCTOR OK` | Handle each `NOTE` line as the doctor skill says, then launch. |
| `DOCTOR HOLD <reason>` | Wait for the next report, then try again. |
| `DOCTOR PROBLEMS <n>` | Fix what it names, or raise an attention item, before any launch. |

To launch, run `node .tangela/scripts/worktree.mjs <unit> --base <integration branch>` and wait for `WORKTREE READY <path>`. Record it with `program.mjs unit <unit> state=running branch=<branch it printed> base=<integration branch>` and `program.mjs log launch <unit> "launched at <base sha>"`. Then start a worker with the tangela-worker agent, in the background, with this prompt and nothing pasted into it:

```text
You are the tangela worker for unit <unit>.
Worktree: <path>
Brief: <store>/briefs/<unit>.md
Orders: <store>/orders.md
Contract: docs/agents/tangela.md in the worktree
Load the "tangela-work" skill and follow it. Your final message is your report.
```

The tangela-worker agent preloads `tangela-work`. On a harness without it, add "Run on opus at medium effort. Read `.tangela/machine.md` in the repo root before running a command." to the prompt.

Done when `doctor.mjs --launch` holds or no unit is ready. Until then, go back to step 1 after each launch.

### 4. Drain a report

When a worker finishes, write its final message to `reports/<unit>.md` and run `program.mjs unit <unit> state=reported spend=<its spend as the harness reports it>`. Then route each section, as [DRAIN.md](DRAIN.md) says.

Done when every "Decisions taken" line has a `decisions.tsv` row and every "For a person" line has an `attention.md` item.

### 5. Land

Land one unit at a time, in `depends` order, from a clean integration checkout. Load the "tangela-doctor" skill and run `node .tangela/scripts/doctor.mjs`. Land only on `DOCTOR OK`, after handling each `NOTE` line as the doctor skill says. Then load the "tangela-land" skill and follow it. It runs the `merge` tier once and sizes the review to the diff by the orders' Review section. Workers never run `merge`.

On `LAND CONFLICT`, send the unit back to its worker to merge the integration branch into its branch, as [DRAIN.md](DRAIN.md) says.

Done when the unit's row says `landed` with its SHA. Then go back to step 1.

## When the loop ends

The loop ends when no unit is `briefed`, `running` or `reported`. Run `node .tangela/scripts/status.mjs --write`, whose ratchet counts are the ones the last landing measured, and tell the user:

- the units landed, parked and dropped, with spend against the budget;
- each ratchet against its target;
- the open attention items, each with the word that settles it.

When every ratchet is at target and no pending mark is left, tell the user to run `/tangela-close`. When rulings are still unplaced, tell the user to run `/tangela-plan`.
