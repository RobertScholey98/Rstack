---
name: tangela-doctor
description: Preflight a tangela checkout with doctor.mjs and judge each line it prints, then say go, hold or stop. Use before launching a tangela worker, before landing a unit, or when a gate's results look like the machine or someone else's changes rather than the code.
---

# tangela-doctor

A program shares its machine and its branch with a person and with other agents. The doctor shows what changed around the program since it last looked, and whether the machine can take more work. Run it from the checkout of the integration branch:

```bash
node .tangela/scripts/doctor.mjs            # before a landing
node .tangela/scripts/doctor.mjs --launch   # before starting a worker
```

If the script is missing, tell the user to run `/tangela-setup`.

The last line is the script's verdict: `DOCTOR OK`, `DOCTOR PROBLEMS <n>` (exit 1), or `DOCTOR HOLD <reason>` (exit 3). Above it, each check prints one line starting with its label. A line marked `PROBLEM` counts toward `DOCTOR PROBLEMS`. A line marked `NOTE` doesn't: the verdict can be `DOCTOR OK` with notes above it, and each note is yours to judge. Read every line. A line can be fine for a launch and wrong for a landing.

## Judging each line

| Label | A problem looks like | Do | Verdict |
| --- | --- | --- | --- |
| `node` | The running Node differs from the contract's or the repo's version file. | Switch the shell to the pinned version. When the pin itself moved, a commit moved it, and the `branch` note names it. | stop until it matches |
| `hooks` | `core.hooksPath` is missing, or its hook has no tangela block. | Commits from this checkout skip every check without a word. Tell the user to run `/tangela-setup`. | stop |
| `kit` | `.tangela/scripts/kit.json` is missing. A kit older than the plugin shows as a warning from the session-start hook instead, because only the plugin knows its own version. | Tell the user to run `/tangela-setup`, which replaces `.tangela/scripts/` whole. For an old kit, keep using the installed scripts until then. | stop when missing; go, and say so, when old |
| `e2e lock` | The lock is held. | A browser suite is running somewhere on this machine. Wait for it to finish. | hold |
| `ports` | A contract port is held. | Find the holder's working folder. When it is a unit worktree of this program, its dev server outlived its task, so stop that process. Any other holder belongs to the person or another program. Leave it running, and let `worktree.mjs` pick another port. | go |
| `branch`, a `NOTE` | Commits on the integration branch since the last landing that no unit made. | Read each one. They are the person's or another session's. Build on them as they are. Log them with `node .tangela/scripts/program.mjs log note <program> "foreign commits: <short shas>"` and carry on. When one changes the toolchain, the contract, the orders or files a running unit touches, say so in your reply. | go, and say so |
| `drift`, a `NOTE` | One rule stated in two steering files. | Run `node .tangela/scripts/checks/drift.mjs` for the pairs, and add each pair to the friction the next landing routes, which keeps the rule in one home. When the two copies disagree, also raise an attention item, and the orders win until it's settled. | go, and route it |
| `load` | CPU or memory over the orders' thresholds. | Workers started now slow every gate, and gates under load fail tests that pass alone. Wait for a running unit to report, or for the reading to drop. | hold |

With `--launch`, `DOCTOR HOLD` means no new worker now. Wait for a running unit to report, then run the doctor again. The ceiling and the thresholds live in the orders' Concurrency section. A person changes them there, by a ruling.

Before a landing, a high load reading is a hold too. The merge tier would run on a busy machine, and its failures would need classifying as load.

Done when every line that isn't clean has a verdict and an action taken or scheduled. The overall verdict is the strictest one: stop, then hold, then go.

## Reply

```markdown
Doctor: <go | hold | stop>. <the script's last line>
- <each line that isn't clean: what it showed, what you did or will do>
Foreign commits: <short sha and subject each, or none>
Drift: <each pair, routed to the next landing, or none>
```

Then carry on with the launch or the landing that called for the doctor, or wait, as the verdict says.
