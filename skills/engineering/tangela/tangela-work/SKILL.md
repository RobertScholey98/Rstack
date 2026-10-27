---
name: tangela-work
description: The contract a tangela worker follows to finish one unit from its brief. Pin behaviour first, prove new tests red, commit one step at a time, verify through the gate, and hand back a report of facts. Use when working a tangela unit, or when started as a tangela worker.
---

# tangela-work

You are working one **unit** of a tangela program. The **brief** says what to achieve and what proof counts. The program's **orders** say how to behave. The repo contract (`docs/agents/tangela.md`) says how to verify.

## Before the first change

1. Read the brief, the orders and the contract, by the paths you were given. Note the orders' version: your report names it.
2. Check the worktree is ready: `.tangela/worktree.json` exists, and every file the contract lists under `worktree.copy` is present. If not, stop and report it. Don't recreate those files by hand.
3. Find every pending mark the brief names. They are your scope and your acceptance test.
4. Follow the brief's **outcome** over any mechanism it suggests. If the outcome is already true, the answer is "no change, with evidence".

## Each step

1. **Pin** the behaviour you're about to change, unless a test already pins it: a test, snapshot or recorded output that passes on the current code. Then change the code under the pin.
2. **Prove it red.** A new test counts only if it fails on the old code, the way the bug really happens. Run it against the old code once, and keep the failing line for your report.
3. **Make the rule fail the build** where you can: a type, a lint rule or a check beats a comment or a convention.
4. **Flip** each pending mark as its behaviour is fixed.
5. **Commit** the step through the repo's real hook, with its own message. Change nothing in the tree while the hook runs. A move or a rename is a commit of its own, with no content changes.
6. **Re-read the orders** before the next step. They can change while you work.

## Verify

Load the "tangela-verify" skill, and run the `unit` tier on your final commit before you report. No pending mark the brief names may be left.

## Habits

- Keep scratch files in `.tangela/scratch/<unit>/` only, never in a temp folder another worker might share.
- Edit files with the harness's file-editing tool. Shell redirection and stream editors can change line endings and add byte-order marks.
- Hand a search that spans many files to a cheap read-only sub-agent, and keep its conclusion, not its file dumps.
- Before reporting, read your own diff once, and remove anything the brief didn't ask for.
- Stop starting new steps at about 70% of the brief's budget. Finish the step in hand, then report what's done and what's left.

## When something is in the way

- **A call only a person can make.** Take the brief's default, or the more reversible option. Record it, carry on, and report it with the one word that reverses it.
- **A broken environment, or a base that fails before your change.** Report it with evidence. Fix it only if the brief says to.
- **A brief that contradicts the orders.** The orders win. Say so in the report.

## Report

Hand back the report in [REPORT.md](REPORT.md). Facts come first: commits, test names, counts and the gate's verdict line, each one checkable.
