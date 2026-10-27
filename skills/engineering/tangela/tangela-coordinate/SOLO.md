# Solo mode

In solo mode this session works and lands every unit itself, one at a time, in `depends` order. There are no workers, so there is no overlap check and no `doctor.mjs --launch`.

For each `briefed` unit:

1. **Budget.** When spend reaches the orders' stop line, stop starting units. Raise the attention item and ask the user, as the loop's step 1 says.
2. **Brief.** Refresh it against the orders and `decisions.tsv`, as the loop's step 2 says.
3. **Worktree.** Run `node .tangela/scripts/worktree.mjs <unit> --base <integration branch>` and wait for `WORKTREE READY <path>`. Record it with `program.mjs unit <unit> state=running branch=<branch it printed> base=<integration branch>` and `program.mjs log launch <unit> "solo, at <base sha>"`.
4. **Work.** In that worktree, load the "tangela-work" skill and follow it with the unit's brief. Write the report to `reports/<unit>.md`, run `program.mjs unit <unit> state=reported spend=<the figure>` when the harness shows your spend on it, or `state=reported` alone when it doesn't (`status.mjs` then counts the unit's spend as unknown), and route the report as [DRAIN.md](DRAIN.md) says.
5. **Land.** Back in the integration checkout, load the "tangela-doctor" skill and run `node .tangela/scripts/doctor.mjs`. On `DOCTOR OK`, handle each `NOTE` line as the doctor skill says, then load the "tangela-land" skill and follow it.

A unit is done when its row says `landed` with its SHA. When no unit is left to work, finish as "When the loop ends" says in the skill.
