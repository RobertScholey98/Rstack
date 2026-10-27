---
name: tangela-work
description: The contract for finishing one tangela unit from its brief. Pin, prove each new test red, commit one step at a time, gate, and report facts. Use when working a tangela unit, as a worker or in solo mode.
---

# tangela-work

You are working one **unit** of a tangela program. The **brief** says what to achieve and what proof counts. The program's **orders** say how to behave. The repo contract (`docs/agents/tangela.md`) says how to verify.

## Before the first change

1. Read `.tangela/program.json`. Its `store` holds the orders (`<store>/orders.md`) and your brief (`<store>/briefs/<unit>.md`). Read both, and the contract. Done when you can name the orders' version, which your report repeats.
2. Check the worktree is ready: `.tangela/worktree.json` exists, and every file the contract lists under `worktree.copy` is present. When one is missing, stop and report it, because the worktree script owns those files. Done when every file is present, or your report names the missing one.
3. Find every pending mark the brief names. They are your scope and your acceptance test. Done when a search for the unit's tag has listed each mark with its file and line.
4. Follow the brief's **outcome** over any mechanism it suggests. If the outcome is already true, the answer is "no change, with evidence". Done when you can name the test or count that will show the outcome, or hold the evidence that it is true already.

## Each step

1. **Pin.** Load the "principle-pin-then-change" skill. Done when a test pins the behaviour you're about to change and passes on the current code.
2. **Change** the code under the pin. Done when the change is made and the pin passes, unedited.
3. **Make the rule fail the build** where you can: a required type, a lint rule or a check, in place of a comment or a convention. Done when a planted violation fails it, or you can say why no check fits.
4. **Flip** the marks the step fixes. Load the "principle-marks-are-the-finish-line" skill. Done when the step's marks are gone and their tests pass as ordinary tests.
5. **Commit** the step through the repo's real hook, with its own message, and leave the tree untouched while the hook runs. A move or a rename is a commit of its own, holding only the move. Done when the hook passed and `git status` is clean.
6. **Prove it red.** Load the "principle-prove-it-red" skill. It runs against the commit, since it refuses uncommitted files. Done when each new test of new or changed behaviour has `RED PROVEN` and its failing line.
7. **Re-read the orders.** They can change while you work. Done when you know their current version and follow it.

## Verify

Load the "tangela-verify" skill, and run the `unit` tier on your final commit. Done when the verdict gated HEAD and no mark the brief names is left.

## Habits

- Keep scratch files in `.tangela/scratch/<unit>/`, a folder no other worker writes to.
- Edit files with the harness's file-editing tool, which keeps line endings and encoding as they were.
- Hand any search across many files to a sub-agent started with the tangela-explorer agent, which writes only the output file its prompt names, and keep its conclusion.
- Before reporting, read your own diff once, and take out anything the brief didn't ask for. A real problem outside the brief goes in the report.
- Start no new step past the orders' stop line of the brief's budget. Finish the step in hand, then report what's done and what's left.

## When something is in the way

- **A call only a person can make.** Take the brief's default, or the more reversible option. Record it, carry on, and report it with the one word that reverses it.
- **A broken environment, or a base that fails before your change.** Report it with evidence. Fix it only if the brief says to.
- **A brief that contradicts the orders.** The orders win. Say so in the report.

## Report

Run `node .tangela/scripts/report-facts.mjs` and paste its output into the report in [REPORT.md](REPORT.md). Add what only you know: the proofs, the failures classified, the decisions taken and the friction. Hand it back as your final message. Done when every claim in it is a **fact**, as REPORT.md defines it.
