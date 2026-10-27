---
name: principle-marks-are-the-finish-line
description: Known-wrong behaviour gets a pending mark tagged with the unit that will fix it, the unit flips its marks, and it lands only when none are left. Use when recording behaviour that is wrong today, scoping a unit, or deciding whether a unit is finished.
---

# Marks are the finish line

Known-wrong behaviour gets a **pending mark** tagged with the unit that will fix it. That unit flips its marks, and it lands only once every one is flipped.

## Why

A mark tagged with its unit is the unit's scope and its acceptance test in one. A search for the tag lists every site the unit must touch. Flipping the marks proves the fix through tests that already exist, which matters most for behaviour that is hard to reach by hand. A mark left after its unit lands misstates the code, and nobody searches for one by hand, so a check finds it.

## Writing a mark

Mark the test with the runner's expected-failure form, such as `test.fails` in vitest, `test.failing` in jest or `xfail` in pytest. Use `todo` only on a runner with nothing else, such as node:test. Never use a skip: an expected failure that starts passing tells you, and a skip stays silent. Start the reason with the unit id, in the form the contract's `marks` pattern matches, then say what is wrong. The mark is written when every test of the known-wrong behaviour carries one and the pattern finds each.

## Flipping a mark

1. Fix the behaviour and remove the mark in the same commit. The test then passes as an ordinary test.
2. A mark you can't flip stays, and your report names it with the reason.
3. Marks tagged with other units stay as they are. Their expected failures in your test runs are theirs.

The unit is finished when a search for its tag finds no mark.

## Check it

`node .tangela/scripts/checks/pending-marks.mjs` fails on a mark whose unit has landed, or whose unit isn't in the program. `node .tangela/scripts/report-facts.mjs` lists the marks a unit flipped.
