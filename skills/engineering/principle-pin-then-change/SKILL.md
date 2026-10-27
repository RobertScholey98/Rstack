---
name: principle-pin-then-change
description: Pin behaviour in a test or snapshot that passes on today's code, then change the code under the pin. Use when about to refactor, move or migrate code, merge another unit's work, or apply a review suggestion.
---

# Pin, then change

Before you change behaviour, pin it in a test or snapshot that passes on today's code. Then change the code under the pin.

## Why

A pin turns every drift into a named diff. When a change alters pinned behaviour, the test fails or the snapshot changes, so each difference is listed as intended or fixed, never guessed at. A pin that stays green through a run of commits proves each one kept behaviour. Pins also protect work you don't own, such as another unit's change you merge, and they show when a review suggestion would change behaviour before it lands.

## Steps

1. **Find the pin.** Look for a test that fails if the behaviour changes. When none exists, write one that calls the code the way its users do, and commit it on its own. Done when the pin is committed and passes on the unchanged code.
2. **Change under the pin.** Each commit keeps the pin green. Done when the change is complete and the pin still passes, unedited.
3. **Change a pin only on purpose.** When the outcome needs pinned behaviour to change, update the pin in the same commit as the code change that needs it, and cite the ruling or brief line that asks for it in the message. A commit of its own would leave a red commit. A pin edited with no such citation is a regression to fix.

## Check it

In `node .tangela/scripts/report-facts.mjs`, the pin's commit comes before the commits that change the code it pins. The report's **Pinned** line names it.
