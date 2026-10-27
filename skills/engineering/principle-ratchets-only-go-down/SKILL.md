---
name: principle-ratchets-only-go-down
description: Gate on today's count of a pattern being retired; lower it when you can, never raise it. Use when retiring a pattern with many existing sites, setting a ratchet's baseline, or when a change would raise a gated count.
---

# Ratchets only go down

Gate the build on today's count of what you are retiring. Every change that removes some lowers the gated number in the same commit. A change that raises the count fails.

## Why

A rule with hundreds of existing violations can't be an error on day one, and a rule left as advice is ignored. A count gated at today's value stops new violations at once, without blocking the work that removes the old ones. Each lowering locks in the progress, so nobody has to remember the standard.

Three things make it go wrong:

- **An estimated baseline.** Counts estimated by eye came out far below the real number. Take the count from a command, and keep the command, so every later count is taken the same way.
- **A blind count.** A warning count misses every site already silenced with an inline disable comment, so the first baseline can read zero for a rule broken everywhere. Count the suppressions as a second ratchet.
- **A hand-kept record.** A table of counts in a document went stale while the gated numbers stayed true. The gate's number and the store's `ratchets.tsv` are the record.

A count can rise once for a good reason: the rule itself got wider and now sees sites it missed. That is a new baseline, logged as a decision with its reason, never a quiet edit.

## Apply it

1. Write a command that prints the count as one integer, and record the count it gives today.
2. Make the gate fail above that number: the linter's maximum-warnings flag, or a check script's exit code.
3. In any change that removes sites, lower the number to the new count in the same commit.
4. At zero, turn the warning into an error and set the row at its target.

## Check it

`node .tangela/scripts/status.mjs --measure` reruns each ratchet's command and records the count beside its baseline and target. A row whose count exceeds its baseline is a broken ratchet.
