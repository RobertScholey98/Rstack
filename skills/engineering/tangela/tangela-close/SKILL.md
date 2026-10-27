---
name: tangela-close
description: End a tangela program once every ratchet is at target and no pending mark is left. Fold the log into the repo's docs, then archive the store.
disable-model-invocation: true
---

# tangela-close

A program ends when its finish line is met in the code, not when its units run out. Closing proves that, moves what the program learned into the repo's own docs, and takes the program's rules out of the way of the work that follows.

Run it from the checkout of the integration branch. `node .tangela/scripts/program.mjs` prints the program and its store. If it prints `PROGRAM NONE`, there is nothing to close.

## 1. Prove the finish line

1. Run `node .tangela/scripts/status.mjs`. Every ratchet's count, as the last landing measured it, is at or under its target. The merge tier in check 6 gates each ratchet the build enforces.
2. Every unit in `units.tsv` is `landed` or `dropped`. For a unit in any other state, briefed or not, the user decides whether to drop it or carry it into a new program. Ask with the harness's question tool, one unit at a time, recommendation first. Log the answer with `node .tangela/scripts/program.mjs log ruling <unit> "<drop or carry>" --by person`, and set a dropped unit with `program.mjs unit <unit> state=dropped`.
3. Search the paths in the contract's `marks` field for its pattern. No pending mark is left, whatever unit it names.
4. `attention.md` has no open item.
5. Load the "tangela-doctor" skill and run it. It ends `DOCTOR OK`, and each `NOTE` line is handled as the doctor skill says.
6. Load the "tangela-verify" skill and gate the `merge` tier on the integration branch's head, so the last landing and every commit after it are proved together.

When a check fails, stop. Tell the user what's left, and that `/tangela-plan` cuts it into units. A ratchet's target stays where it is. If the user wants to close short of it, log their ruling with `program.mjs log ruling <program> "close short on <ratchet>" --evidence "<count> against target <t>" --by person`.

Done when all six hold, or the user has ruled to close short with the gap recorded.

## 2. Fold the log into the repo

The program's log lives in `<log>/<program>/`, one entry per landed unit (the contract's `log` field, default `docs/tangela/log`). Its lasting facts move to the doc where a reader will look for them:

| From the log | Goes to |
| --- | --- |
| What a ruling turned out to mean in practice | the ADR that holds the ruling |
| Where a kind of code goes, and recipes that worked | the repo's conventions doc |
| Words the program used | the glossary |
| Ratchets at target | the contract's `commit` or `merge` tier, as a check, when it isn't one already |
| Instructions that applied only while the program ran (the integration branch as a base, the orders' rules) | deleted from every steering file that states them |

Then replace the per-unit entries with one summary, `<log>/<program>.md`: what changed, each ratchet from baseline to final count, the ADRs, and the landed units with their SHAs. Git history keeps the entries.

Run `node .tangela/scripts/checks/doc-paths.mjs` and `node .tangela/scripts/checks/drift.mjs`, and fix every dead path and every rule stated twice. Commit on the integration branch through the hook.

Done when every log entry's facts have a home or are in the summary, both checks exit 0, and the commit is made.

## 3. Archive

Remove each unit worktree that is left with `node .tangela/scripts/worktree.mjs --remove <unit>`. Each holds its own copy of the program's file, so a forgotten one still claims to belong to the program. Then:

```bash
node .tangela/scripts/program.mjs archive
```

Done when it prints `PROGRAM ARCHIVED <path>`.

## Reply

```markdown
Closed <program>. Merge tier on <sha>: <verdict line>.
Ratchets: <name> <baseline> to <final> (target <t>), one per line.
Units: <k> landed, <k> dropped. Rulings to close short: <none, or each>.
Folded into: <each doc changed>. Summary: <path>. Commit: <sha>.
Store archived at <path>.
```

Then tell the user three things:

- The integration branch is ready for its release into the default branch. That step is theirs. It runs the `release` tier, then a merge or a pull request, as the repo does it.
- Run `/retro` on the program, pointing it at the archived store. Its `retros/` folder holds each landing's friction routing.
- The next program starts with `/tangela-investigate`.
