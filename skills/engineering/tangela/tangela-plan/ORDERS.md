# Filling the orders

`program.mjs init` writes `orders.md` into the store from the kit's template, with defaults in every section but Budget and Program-specific. Your job is to fill those two, and to change a default only where this program needs it.

Load the "principle-one-home-one-writer" skill first, and check each line against its table of homes before it goes in. The orders hold only rules for every agent in this program and no other. In a tangela repo, the repo's home is the contract, `docs/agents/tangela.md`, and the machine's is `.tangela/machine.md`. How a tangela worker works, in any program, lives in `tangela-work`, so leave it out.

## Section by section

| Section | Fill it with |
| --- | --- |
| Never | The template's lines. Add a line only for an action that would be costly to undo, such as editing a file the user owns. |
| Always | Rules every worker in this program follows that no other home holds. The commonest is a single writer for a shared document, such as "Workers put the log entry they'd write in their report. Landing writes it." |
| Models | The template's defaults, including the second reviewer's model, which landing uses when the Review section calls for a second reviewer. Change a role only on the user's ruling, and log it. |
| Concurrency | The defaults, unless the user rules otherwise. Lower the ceiling when every unit runs the same heavy suite, since parallel suites on one machine are the commonest source of failures that pass alone. |
| Review | The defaults. Change the line threshold only on the user's ruling. |
| Verification | The defaults. Workers run `unit`, and the gate widens it. Only landing runs `merge`. |
| Budget | The amount the user gave in planning step 4, in the unit they count in: tokens, hours or sessions. Keep the stop line, `- Stop launching at: 70%`, unless the user rules another percentage. `status.mjs` reads it, and every skill says "the orders' stop line" for it. Without a budget, nothing stops the launches. |
| Program-specific | The mode (solo or coordinated), the integration branch, and each program rule the sections above don't cover. |

## Lines that do nothing

Leave out any line an agent already follows without it. Two kinds recur:

- **Availability.** "The user is asleep" or "work without asking" adds nothing: `tangela-work` already takes the brief's default when nobody can be asked.
- **Restatements.** A rule copied from the contract or the repo's agent rules. It drifts the first time one copy changes. `node .tangela/scripts/checks/drift.mjs` finds them.

## Changing the orders mid-program

Workers re-read the orders before each step, so a change reaches running units at their next commit. Work done before it isn't redone. So cost rules (which suites a worker runs, how many reviewers) go in before the first launch.

Every edit bumps the version line and logs `node .tangela/scripts/program.mjs log orders <program> "Version <n>: <what changed>" --why "<the reason>" --by <who asked>`.
