# Engineering

Generic skills that stand on their own and that tangela leans on, including the `principle-*` leaves. tangela's own skills are in [tangela/](./tangela/README.md).

## User-invoked

Only a person can run these, by typing the name.

- **[grill-me](./grill-me/SKILL.md)**: A relentless interview to sharpen a plan or design, one question at a time.
- **[grill-with-docs](./grill-with-docs/SKILL.md)**: The same interview, which also writes the glossary and ADRs as decisions settle.
- **[retro](./retro/SKILL.md)**: Review a coding session and suggest improvements to the agent's environment: checks, standards, steering files and tooling.

## Model-invoked

The model reaches for these when a task fits, and so can you.

- **[grilling](./grilling/SKILL.md)**: Interview the user one question at a time until a plan is settled.
- **[domain-modeling](./domain-modeling/SKILL.md)**: Build and sharpen a project's domain model: challenge terms, test them against scenarios, and update `GLOSSARY.md` and ADRs inline.
- **[codebase-design](./codebase-design/SKILL.md)**: The vocabulary for designing deep modules: small interfaces at clean seams, testable through the interface.
- **[tdd](./tdd/SKILL.md)**: Test-driven development with a red-green-refactor loop, one vertical slice at a time, at seams agreed up front.
- **[code-review](./code-review/SKILL.md)**: Review a diff on two axes in parallel: Standards (the repo's documented standards plus a code-smell baseline) and Spec (does it do what the spec asked).

### Model-invoked: principle leaves

One rule each, with the reason and the check that enforces it. Skills load them by name.

- **[principle-one-way-per-concern](./principle-one-way-per-concern/SKILL.md)**: Where two patterns do one job, keep one, delete the other and ban it.
- **[principle-ratchets-only-go-down](./principle-ratchets-only-go-down/SKILL.md)**: Gate on today's count of a pattern being retired, and only ever lower it.
- **[principle-outcome-not-mechanism](./principle-outcome-not-mechanism/SKILL.md)**: A brief names the outcome and the proof, defines its words, and allows "no change, with evidence".
- **[principle-one-home-one-writer](./principle-one-home-one-writer/SKILL.md)**: Each rule has one source, and each shared file has one writer.
- **[principle-pin-then-change](./principle-pin-then-change/SKILL.md)**: Pin behaviour in a passing test or snapshot, then change the code under the pin.
- **[principle-prove-it-red](./principle-prove-it-red/SKILL.md)**: A new test counts only if it fails on the old code, the way the bug really happens.
- **[principle-marks-are-the-finish-line](./principle-marks-are-the-finish-line/SKILL.md)**: Known-wrong behaviour gets a pending mark tagged with its unit, and the unit lands only when its marks are flipped.
- **[principle-rerun-alone-then-decide](./principle-rerun-alone-then-decide/SKILL.md)**: A failure is load, pre-existing or real only after it has rerun alone on the branch and on the base.
