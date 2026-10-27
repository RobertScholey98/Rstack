---
name: tangela-verify
description: Run a tangela verification tier through the kit's gate and classify every failure before acting on it. Use when a tangela worker or coordinator verifies a unit, when a gate fails or flakes, or when deciding whether a failure is load, already broken on the base, or real.
---

# tangela-verify

Verification in a tangela program is a ladder of **tiers**, each named by who runs it and when. The repo contract (`docs/agents/tangela.md`) lists each tier's commands. The kit's gate runs them:

```bash
node .tangela/scripts/gate.mjs <tier>
```

| Tier | Run by | When |
| --- | --- | --- |
| `commit` | the commit hook | every commit |
| `unit` | the worker | once, before its report |
| `widened` | the gate, in place of `unit` | when the diff touches a path the contract lists under `widen` |
| `merge` | the coordinator | once per landing |
| `release` | a person, or CI | when the integration branch goes into the default branch |

A worker runs `unit`, and the gate widens it by itself when the diff touches shared code. A worker never runs `merge`. That tier belongs to the coordinator, and a worker repeating it is the most expensive mistake a program can make.

If `.tangela/scripts/gate.mjs` or the contract is missing, stop and say so. Tell the user to run `/tangela-setup`. Don't run the tier's commands by hand, and don't write a runner of your own.

## Reading the verdict

The gate's last line is the verdict, and `.tangela/logs/last-gate.json` holds the detail, including the commit it gated.

| Verdict | Exit | Do |
| --- | --- | --- |
| `GATE PASS` | 0 | Done. Quote the verdict line in your report. |
| `GATE LOAD` | 3 | Every failure passed when rerun alone. Record it as load, with the load reading the gate printed. Don't change code for it. |
| `GATE FAIL` | 1 | Classify each failure before touching code. |
| `GATE BROKEN` | 2 | The contract or the setup is wrong. Report it, and don't work around it. |

A gate waiting on the e2e lock is working as intended: another checkout is running a browser suite. Wait. Never delete the lock while its holder is alive.

## Classifying a failure

A failure is one of three things, and only rerunning it alone, with retries off, can tell you which.

| Rerun alone | It's | Do |
| --- | --- | --- |
| passes on the branch and on the base | load | Record it with the load reading. |
| fails on the base too | pre-existing | Record it as not yours, with the evidence, and carry on. |
| fails on the branch only | real | Find the root cause and fix it before reporting. |

The gate reruns each named failure alone on your branch when the step has a `rerun` command. A failure that still fails alone is real or pre-existing, and the base decides which: run the same rerun command in a checkout of the base branch before you claim or disown it. A step without a `rerun` command or a `failures` pattern can't be classified automatically. Rerun the failing test alone yourself, and suggest adding both to the contract.

## Rules whatever the class

- Never raise a timeout, add a retry, or skip or mark a test to make a gate pass.
- A test that passes only on a retry has not passed.
- Gate the commit you report. Commit first, then gate; a verdict for an earlier commit proves nothing about this one.
- Report numbers, not adjectives: the verdict line, the counts, the times and the load reading.
- If the gate didn't finish (a lock timeout, a broken contract), say so. Never report a pass you didn't see.
