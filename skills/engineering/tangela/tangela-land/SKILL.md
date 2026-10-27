---
name: tangela-land
description: Land one finished tangela unit on the program's integration branch. Use when a tangela unit has reported and is ready to merge, or when a landing failed or conflicted.
---

# tangela-land

You land one **unit**: its branch goes into the program's integration branch through the `merge` tier, and the program learns from it before the next unit starts. In coordinated mode the coordinator lands. In solo mode you land your own unit.

Find the program with `node .tangela/scripts/program.mjs`. It prints the store. Run everything below from the checkout of the integration branch unless a step says otherwise.

## 1. Preflight

Load the "tangela-doctor" skill and run it before you land. Land only on `DOCTOR OK`, after handling each `NOTE` line as the doctor skill says. Landing waits while it says hold or stop.

Then check the unit. Its `units.tsv` state is `reported`, `reports/<unit>.md` exists, and the report's gate line gated the branch's last commit. A unit whose report says "no change, with evidence" and whose branch has no commits skips sections 2 and 3. Record it as [ROUTING.md](ROUTING.md) says under "No-change units", then do sections 4 to 6.

Done when the doctor's verdict is go and all three facts hold.

## 2. Review, sized to the diff

The orders' Review section says how many reviews the diff needs. One review is one pass of what a step below starts, so code-review's two axes count as one. Count changed lines with `git diff --shortstat <integration branch>...tangela/<unit>`, insertions plus deletions.

1. From the unit's worktree, load the "code-review" skill. The fixed point is the integration branch. The spec is `briefs/<unit>.md` in the store.
2. When the Review section calls for a second reviewer, start a sub-agent with the tangela-reviewer agent on the second-reviewer model from the orders' Models section. Give it the same diff command, brief and standards files, and ask for its findings in its final message, so it writes no file.
3. Judge every finding: apply, reject with a reason, or send to a follow-up unit.
4. A finding that changes behaviour is **verify first**. Load the "principle-pin-then-change" skill, and apply the finding only under a test that pins the behaviour. A finding no test can settle is rejected, with that as the reason.
5. Commit applied findings on the unit's branch, in its worktree, through the hook. Then load the "tangela-verify" skill and gate the `unit` tier on the new head.

Done when every finding has a verdict and, if anything was applied, the `unit` gate passed on the branch's last commit.

## 3. Merge

```bash
node .tangela/scripts/land.mjs <unit>
```

| Last line | Exit | Do |
| --- | --- | --- |
| `LAND DONE <sha>` | 0 | Go on to section 4. |
| `LAND CONFLICT <files>` | 1 | The merge was aborted. The unit's branch merges the integration branch once, in its worktree, by whoever owns the conflicting code (the unit's worker in coordinated mode), commits, gates `unit`, and lands again. |
| `LAND FAIL` | 1 | Load the "principle-rerun-alone-then-decide" skill and classify each failure. Real: run the undo line land.mjs printed, and the unit goes back to work. Pre-existing: run the undo line, and raise an attention item, because the merge tier is red on the base. A failure before the commit (a pending mark, the `commit` tier) prints no undo line, because nothing was committed: fix what it names and land again. |
| `LAND REFUSED <reason>` | 2 | Nothing was merged. Fix what it names: the checkout's branch, an unclean tree, or the unit's state in `units.tsv`. Then land again. |
| `LAND LOAD` | 3 | Every failure passed alone. Run any undo line printed, wait until the doctor's load line is under its threshold, and land again. |

Done when the last line is `LAND DONE`.

## 4. The log entry

Read the `log` folder from the contract's block (default `docs/tangela/log`). Run `node .tangela/scripts/status.mjs --measure`. It reruns each ratchet's command and records the counts, and this is the one place a program measures them. Write `<log>/<program>/<unit>.md` from [LOG-ENTRY.md](LOG-ENTRY.md), with those numbers. Commit it on the integration branch through the hook, as `log: land <unit>`. Only the lander writes the log.

Done when the entry is committed and every claim in it is a fact.

## 5. Route the friction, today

Read the report's **Friction**, **Decisions taken** and **For a person** sections, and every review finding sent onward. Route each line to one destination with [ROUTING.md](ROUTING.md), make the change, and write `retros/<unit>.md` in the store.

Done when every line has a destination and either a change made (a commit, an orders version, a unit id) or an attention item.

## 6. Clean up

Remove the unit's worktree from this checkout with `node .tangela/scripts/worktree.mjs --remove <unit>`. Run `node .tangela/scripts/checks/pending-marks.mjs`. A mark naming this unit is a landing that should not have happened: fix it before the next landing. Then run `node .tangela/scripts/status.mjs --write`.

Done when the worktree is gone, `pending-marks.mjs` exits 0 (or 2, for a contract without marks), and `status.md` is rewritten.

## Reply

```markdown
Landed <unit> as <sha>. Merge tier: <verdict line>.
Review: <n> reviews, <k> findings applied, <k> rejected, <k> sent on.
Log: <path>. Friction: <k> lines routed (<k> orders, <k> contract, <k> conventions, <k> machine, <k> fixes, <k> attention).
Status: <status.mjs last line>
Next: <the next unit to land, or back to coordinating>
```

When `status.mjs` shows every ratchet at target and no unit left to land, tell the user to run `/tangela-close`. For a deeper look at a unit's friction than this routing gives, tell the user `/retro` exists.
