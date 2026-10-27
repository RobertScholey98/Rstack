---
name: principle-one-way-per-concern
description: Where two patterns do one job, keep one, delete the other, and ban it. Use when a codebase does one thing several ways, when ruling which way wins, or when adding a second way to do something the code already does.
---

# One way per concern

Where two patterns do one job, keep one, move every caller to it, delete the other, and ban it so it can't come back.

## Why

Every extra way to do a job is a choice each reader and each agent makes again, and an agent copies whichever way it saw first. Documenting the preferred way doesn't stop it, because an agent learns from the code around it more than from the docs beside it. A ban does: once the losing pattern fails lint, no new caller can pick it, and its count can only fall.

Keeping both "for now" keeps the choice alive. Each new caller picks one, and the migration never ends.

## Apply it

1. **Count the ways.** List every way the code does the job, with a site count for each, from a search.
2. **Pick the winner.** Usually the one the ecosystem settled on, or the one the library already provides. A hand-rolled copy of a library feature loses.
3. **Ban the loser** before you move its callers: a restricted import or rule at error when the sites are few, or at warning held by a ratchet when they are many.
4. **Move every caller, then delete the loser**, in one wave of units. When the count reaches zero, the warning becomes an error.

## Check it

A baseline's ways-per-concern table counts the ways. `tangela-encode` turns the ruling into the ban, and the ratchet in `ratchets.tsv` counts the callers left.
