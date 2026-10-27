---
name: principle-rerun-alone-then-decide
description: A failing test is load, pre-existing or real only after it has rerun alone, with retries off, on the branch and on the base. Use when a test or gate fails, flakes, or passes only on a retry, before changing code for it or calling it someone else's.
---

# Rerun alone, then decide

A failure is load, pre-existing or real only after it has rerun alone, with retries off, on the branch and on the base.

| Rerun alone, the same number of times on each | It's | Do |
| --- | --- | --- |
| passes every run on the branch and on the base | load | Record it with the machine's load reading. Change no code. |
| fails on the base too | pre-existing | Record it as not yours, with the base's result, and give it an owner. |
| fails on the branch, even once, and never on the base | real | Find the root cause and fix it before the work lands. |

**Why.** When several agents share one machine, a full run fails tests that pass on their own, and a whole gate can go red with nothing wrong in the code. Treating each of those as a bug sends work after timing. Retrying until green hides the other case: a real race that fails only some of the time when run alone, and never on the base. The rate is the evidence. A handful of failures in a long run of repeats on the branch, against none in as many on the base, is a bug the branch brought in. A test that passes only on a retry has not passed.

**Check it.** In a tangela program, the kit's `gate.mjs` reruns each named failure alone on the branch with retries off, the contract's `repeat` times, and prints `GATE LOAD` when all of them pass. For the base, run the same rerun command in a checkout of the base branch, as many times. Elsewhere, rerun the one test by name with the runner's retries set to zero and a repeat count, on both.
