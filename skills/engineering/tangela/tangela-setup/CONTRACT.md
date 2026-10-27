# The contract template

Write this to `docs/agents/tangela.md`, replacing everything in angle brackets. The prose is for people and agents. The kit reads only the fenced block, so keep the two in step. Drop a section only when it has nothing to say. Leave out a tier the repo has no commands for: the kit refuses an empty one, because a tier that runs nothing would always pass.

````markdown
# tangela contract

How this repo verifies work, for the tangela skills and for anyone running a tangela program here. The kit in the gitignored `.tangela/scripts/` reads the block at the end. Its fields are documented in [the kit's README](https://github.com/RobertScholey98/Rstack/blob/main/skills/engineering/tangela/tangela-setup/kit/README.md).

To set up a checkout of your own, run `/tangela-setup`. Without the kit, commits and CI work as they always have.

## Tiers

| Tier | Runs | Takes about |
| --- | --- | --- |
| `commit` | <what the hook runs> | <measured time> |
| `unit` | <commands, and why each is affordable per unit> | <measured time> |
| `widened` | <what's added, and which shared paths trigger it> | <measured time> |
| `merge` | <commands> | <measured time> |
| `release` | <commands> | <measured time> |

<Steps that take the e2e lock, and why.>

## Classifying failures

<For each test step: what a failure line looks like, and the command that reruns one test alone with retries off.>

## Known failures

<Steps left out of every tier because they failed on `<default branch>` at `<short sha>` when this contract was written: the command, and the failing lines. Add a step to its tier once it's fixed. A worker who meets one of these failures records it as pre-existing.>

## Worktrees

<Which gitignored files a worktree copies, and why it needs each. The install command. The port range, what limits it, and how a worktree turns the port in `.tangela/worktree.json` into the repo's own settings (an env var, or an offset when it needs several ports).>

## CI

CI runs the same commands as the gate, without the kit: <where the CI config lives, and which tier each CI job matches>.

## Decisions

<Each call made while writing this contract, and who made it: "unit runs only the touched e2e specs, because the full suite takes 20 minutes (the user)".>

## The block

```json tangela
{
  "contract": 1,
  "defaultBranch": "<branch>",
  "tiers": {
    "commit": [],
    "unit": [],
    "widened": [],
    "merge": [],
    "release": []
  },
  "widen": [],
  "worktree": {
    "copy": [],
    "install": "<frozen install command>",
    "ports": [<low>, <high>]
  },
  "eol": { "crlf": [] }
}
```
````
