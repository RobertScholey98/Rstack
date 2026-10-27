# Draining reports, and sending units back

## Route each section of a report

A report follows `tangela-work`'s REPORT.md. Each section has one home in the store.

| Section | Goes to |
| --- | --- |
| Gate | Check the verdict line is `GATE PASS` or `GATE LOAD`, for the branch's head commit. A verdict for an earlier commit, or none, sends the unit back to gate its head. |
| Gate, `GATE FAIL` on pre-existing failures only | When every failure is classified pre-existing in the failures table, each with its result on the base, the unit's work is done and the base is red. Raise an attention item naming the failures, and keep the unit `reported`. Sending it back would loop it, because the base fails the same way every time. |
| Decisions taken | One row each: `program.mjs log default <ruling ref> "<decision>" --why "<reverse it with>" --by <unit>` when the worker took a ruling's default, `log note <unit> ...` otherwise. |
| For a person | One `attention.md` item each, in the store's format, raised by the unit id. Keep the worker's settling word. |
| Left undone | `program.mjs log note <unit> "left undone: <what>" --by <unit>`. Unplaced work goes to `/tangela-plan` when the loop ends. |
| Friction | Stays in the report. `tangela-land` routes it to the orders, the contract or the conventions when the unit lands. |

The report's commits, proof and failure tables stay in `reports/<unit>.md`, where landing and close read them.

## Send a unit back to merge the integration branch

`land.mjs` aborts a conflicted merge and prints `LAND CONFLICT <files>`. The worker that made the change resolves its conflicts, because it knows which side of each file is right, most of all for files it moved.

Continue the unit's worker with the harness's message to a finished agent, or start a fresh worker with the tangela-worker agent on the same worktree. Use the launch prompt, plus these lines:

```text
Landing conflicted on: <files>
Merge <integration branch> into your branch once, resolve every conflict, run the unit tier on the result, and report again.
```

Record it with `program.mjs unit <unit> state=running` and `program.mjs log land <unit> "conflict, sent back" --evidence "<files>"`.

## Ask for one merge, at the end

While a long unit runs, others land under it. Asking it to merge the integration branch after each landing costs a full re-verify every time. When a running unit overlaps files that units landed after its base, tell it once to merge the integration branch at its final checks, and add nothing more until it reports. A brief written knowing this says so in its "Integration merges" field.
