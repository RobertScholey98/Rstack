# The unit brief

Write one to `briefs/<unit>.md` in the store for each unit. The worker reads it by path, with the orders and the contract, and can't ask you anything. Every field is filled. Write "none" where that is the true answer, and say why in the same line.

Each field below is followed by the questions that fill it, drawn from what workers said their briefs lacked.

````markdown
# Brief: <unit>

**Written against**: orders version <n>, decisions.tsv up to <ts of the last row read>
**Base**: <integration branch>
**Depends on**: <each unit that lands first, and what it leaves this one to use> | none

## Outcome

<What is true when the unit is done, in a sentence or two a stranger could check. Where the outcome may be true already, say so: "no change, with evidence" is a complete answer.>

## Rulings

| Ref | Ruling | Default if it doesn't fit the code |
| --- | --- | --- |
| <decisions.tsv ref> | <the ruling, in its own words> | <what the worker does instead, and logs> |

Supersedes: <each earlier ruling, convention or doc line this unit overrides, named so the worker can find it> | none

## Words

- **<term>**: <what it means here, by what you can observe>

## Where

- <symbols and files to start from: symbols, never line numbers>
- Checked: <each premise the rulings rest on, and the commit it was checked at>

## Proof

- <each requirement, with the number or the test that shows it's met>
- Pending marks: <the tag this unit flips, and any marks moved here from another unit's tag>
- Behaviour that changes on purpose: <each one, and the pin or snapshot that changes with it> | none
- Where the live app can't show it: <the proof that counts instead, such as a mocked suite or a fixture>

## Reach

<"unit" | "widened": what the gate will run, and why. When the change touches code most of the app uses and the contract's `widen` list doesn't cover it, name the suites the worker adds.>

## Fence

- Owns: <files only this unit changes>
- Leave alone: <files another running unit owns, and which unit> | none
- Shared: <file, and the only change allowed, such as "add rows at the end of the table"> | none
- Out of scope: <neighbouring work this unit leaves for another unit or for the report>

## When goals pull apart

<Which wins when two things this brief asks for conflict, such as small call-site edits against a cleaner shape.> | none foreseen

## Integration merges

<"none" | "once, at your final checks": merge the integration branch into your branch one time, because <units> land first and touch <files>.>

## Budget

<The unit's budget, in the unit the orders use. Start no new step past the orders' stop line of it.>
````

## Filling each field

| Field | Fill it so that |
| --- | --- |
| Written against | `/tangela-coordinate` can compare it with the current orders version and the newest ruling before launch. |
| Outcome | It names what must be observable, not the tool or syntax that gets there. A suggested mechanism goes under Where, marked as a suggestion. A literal value the ruling didn't test (an exact allow-list, an exact type) becomes a requirement with a check: "no violations, and list each value you add". |
| Rulings | Each row carries a default, because the worker can't ask. A ruling that overrides an older one names the older one, or the worker meets both and guesses. |
| Words | Every term that could be read two ways is defined by observation. A word that names an event or a thing ("when it closes", "the shared wrapper") is checked against the code first: if the event never happens on that path, or the thing is dead code, define what you actually mean. |
| Where | Line numbers move between briefing and launch; symbols don't. "Checked" lists what the explorer confirmed in planning step 2. A ruling that assumed a piece exists ("built into the shared components") says so when it doesn't, and says whether to create it. |
| Proof | Every requirement has a number. "Works under load" names the load; "fast" names the time. A before-and-after comparison says to capture the before first. Behaviour a pin protects but the ruling changes is listed, so the worker changes the pin on purpose. |
| Reach | A change to a primitive, the app shell, routing or build config reaches every area, whatever the touched files suggest. |
| Fence | It is copied from the overlap check. A file in Leave alone is one the worker reads and never edits. |
| When goals pull apart | Any brief with both "keep the diff small" and "leave it cleaner" says which wins. |
| Integration merges | It says "once", never "keep up to date". Repeated merges into a long unit each cost a full re-verify. |
| Budget | It is set before launch. A cost rule that arrives mid-unit lands after the money is spent. |
| Out of scope | Problems found outside it go in the report, never the diff. |
