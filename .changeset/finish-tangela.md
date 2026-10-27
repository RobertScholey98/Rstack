---
"rstack": minor
---

Finish the tangela lifecycle. New skills:

- `tangela`, the router;
- `tangela-investigate`, which runs the baseline and the sweep that start a program;
- `tangela-decide`, `tangela-encode`, `tangela-plan`, `tangela-coordinate`, `tangela-land`, `tangela-close` and `tangela-doctor`.

Also new:

- eight `principle-*` leaves;
- the `tangela-worker`, `tangela-explorer` and `tangela-reviewer` agents;
- a SessionStart hook that reprints a program's orders and status after a compaction.

The kit gains `program.mjs`, `status.mjs`, `land.mjs`, `doctor.mjs`, `report-facts.mjs` and `prove-red.mjs`, plus checks for stale pending marks, rules stated twice, and dead doc paths.
