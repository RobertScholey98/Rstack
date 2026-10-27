# Rstack

Agent skills for Claude Code and Codex. These are the words the tangela bundle uses.

## tangela

**Program**:
One effort to untangle a codebase, from survey to close. It has one set of orders, one store and many units.
_Avoid_: project, initiative

**Unit**:
A piece of a program that one agent can finish and land on its own.
_Avoid_: task, ticket, phase

**Brief**:
What a unit's worker is given: the outcome, the words it uses, the proof that counts, how far verification reaches, and the budget. It names an outcome, never a mechanism.
_Avoid_: prompt, spec

**Report**:
What a worker hands back: facts (commits, test names, counts, times), the decisions it took, and anything left for a person.

**Orders**:
A program's standing rules, in one versioned file in the store. Workers re-read them at each commit. Each rule lives there and nowhere else.
_Avoid_: preferences, rules file

**Store**:
A program's state outside the repo, shared by every worktree: orders, units, briefs, reports, decisions, the attention list and status.

**Contract**:
A repo's own facts for agents, committed as `docs/agents/tangela.md`: the commands for each tier, which paths widen verification, which branch work starts from, what a new worktree needs, and the line-ending policy.
_Avoid_: config

**Kit**:
The scripts that `tangela-setup` copies into a repo's gitignored `.tangela/scripts/` folder. They read the contract.

**Ratchet**:
A count the build gates on that may go down and never up, such as lint warnings or files left in a deprecated folder.

**Pending mark**:
A test of behaviour known to be wrong, marked as expected to fail and tagged with the unit that will fix it. Flipping it is that unit's acceptance test.
_Avoid_: skipped test, todo

**Tier**:
One rung of verification, named by who runs it and when: commit, unit, widened, merge, release.

**Gate**:
Running a tier to a verdict. A failure is classified as load, pre-existing or real before anyone acts on it.

**Landing**:
Merging a finished unit into the program's integration branch through the merge tier, then recording it.
_Avoid_: shipping, releasing

**Solo mode**:
Running the whole lifecycle in one session, with no workers. `tangela-plan` picks it when a program is small enough.

## Relationships

- A **Program** has one **Orders** file, one **Store** and many **Units**
- A **Unit** has one **Brief** and one **Report**, and ends in a **Landing**
- A **Gate** runs one **Tier**, and the **Kit** runs gates from the **Contract**
- A **Pending mark** belongs to the **Unit** that will flip it
