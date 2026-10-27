# tangela

The skills for running a tangela program, from setup to close. [GLOSSARY.md](../../../GLOSSARY.md) defines the words they use.

A program runs in this order:

1. setup
2. investigate
3. decide, which encodes each ruling as it goes
4. plan
5. coordinate
6. close

Coordinate starts a worker for each unit and lands each one that finishes. In solo mode, one session works each unit and lands it before starting the next. Run `/tangela` at any point to see where the program stands.

## User-invoked

Only a person can run these, by typing the name.

- **[tangela](./tangela/SKILL.md)**: Where the program stands, the next skill to run, and what needs you.
- **[tangela-setup](./tangela-setup/SKILL.md)**: Set a repo up for tangela, with its contract, kit and commit hook.
- **[tangela-investigate](./tangela-investigate/SKILL.md)**: Start a program with a baseline of the stack or a sweep for defects. It ends in numbered findings, each with the question it asks you.
- **[tangela-decide](./tangela-decide/SKILL.md)**: Grill the findings into rulings, one question at a time, and write them into ADRs, conventions and the glossary.
- **[tangela-plan](./tangela-plan/SKILL.md)**: Cut the rulings into units and briefs, order the units by file overlap, choose solo or coordinated mode, and write the orders.
- **[tangela-coordinate](./tangela-coordinate/SKILL.md)**: Run a tangela program's units, from launch to landing.
- **[tangela-close](./tangela-close/SKILL.md)**: End a program once every ratchet is at target and no pending mark is left. Fold its log into the repo's docs, and archive its store.

## Model-invoked

The model reaches for these when a task fits, and so can you.

- **[tangela-encode](./tangela-encode/SKILL.md)**: Turn a ruling into a check that fails the build, and record its baseline and legacy violators.
- **[tangela-work](./tangela-work/SKILL.md)**: The contract a worker follows to finish one unit: pin behaviour, prove tests red, commit one step at a time, verify through the gate and report facts.
- **[tangela-verify](./tangela-verify/SKILL.md)**: Run a verification tier through the kit's gate, and classify each failure as load, pre-existing or real before acting on it.
- **[tangela-land](./tangela-land/SKILL.md)**: Land one finished unit on the program's integration branch.
- **[tangela-doctor](./tangela-doctor/SKILL.md)**: Check the machine and the branch before a launch or a landing, and say go, hold or stop.

## Agents

The plugin's [agents](../../../agents/) folder defines three roles the skills start:

- **tangela-worker** works one unit. Opus at medium effort, all tools, with tangela-work preloaded.
- **tangela-explorer** reads and searches, and answers with conclusions. Opus at low effort; it writes only the output file its prompt names.
- **tangela-reviewer** reviews a unit's diff before it lands, or a sweep's candidate findings. Opus at medium effort; it writes only the output file its prompt names.

A harness without plugin agents gets, in the spawn prompt, each role's model and effort and the line "Read `.tangela/machine.md` in the repo root before running a command."
