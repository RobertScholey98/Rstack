# Routing a landing's friction

Every friction line, decision and leftover from a report goes to the one file where the next unit will meet it. Route it the day the unit lands: a lesson held back until the program's retro costs every unit that starts in between.

## Where each line goes

Ask what the line is about, and take the first row that fits.

| The line is about | Destination | The change |
| --- | --- | --- |
| A mistake a script could catch: line endings, a dead path in a doc, a stale mark, a step done by hand more than once | **fix** | A check, a hook step or a kit script. Small: make it now, on the integration branch. Larger: a new unit, `program.mjs unit <id> state=planned "title=<title>"`. |
| How agents behave in this program: models, review, concurrency, what a worker may edit, when to merge | **orders** | Edit `orders.md`, bump its version line, and log `program.mjs log orders <program> "Version <n>: <what changed>"`. Running workers pick it up at their next commit. |
| How this repo verifies or builds a worktree: a tier's commands, a path that should widen, a gitignored file a worktree needs, a port | **contract** | Edit `docs/agents/tangela.md`, prose and block together, and commit it. |
| How the code works: a library's gotcha, where a kind of code goes, a recipe that worked | **conventions** | The repo's conventions doc, or the ADR the line bears on. Commit it. |
| This machine: a shell trap, a toolchain manager, a port another program holds | **machine** | One line in `.tangela/machine.md`. |
| A call only a person can make | **attention** | An item in `attention.md`, in its format, with the default that applies until it is settled. |

A line that fits **fix** goes there even when a sentence elsewhere would also cover it. A rule in prose waits to be read. A check runs every time.

Load the "principle-one-home-one-writer" skill before adding a rule to the orders, the contract or the conventions.

A line that names a one-off with nothing to change, such as a test that took long to write, gets the destination **none** and its reason.

## retros/<unit>.md

```markdown
# Retro: <unit>, landed <sha> on <YYYY-MM-DD>

| Line | From | Destination | Change |
| --- | --- | --- | --- |
| <the friction line, shortened> | friction, decision, for a person, or review | fix, orders, contract, conventions, machine, attention or none | <commit sha, "orders version <n>", unit id, attention ID, or the reason for none> |
```

## No-change units

A unit whose answer is "no change, with evidence" and whose branch has no commits has nothing to merge. Record it from the integration checkout:

```bash
node .tangela/scripts/program.mjs unit <unit> state=landed
node .tangela/scripts/program.mjs log land <unit> "no change" --evidence reports/<unit>.md
```

Its log entry says "No change" under the outcome, with the report's evidence.
