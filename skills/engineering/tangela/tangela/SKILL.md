---
name: tangela
description: Where the tangela program stands, the next skill to run, and what needs you.
disable-model-invocation: true
---

# tangela

Tell the user three things: where the program stands, the next skill to run, and every question waiting on them. You name each skill for the user to run, and the user runs it.

## 1. Find the program

Check, from the repo root, in this order. The first that fails decides the answer.

| Check | When it fails |
| --- | --- |
| `docs/agents/tangela.md` and `.tangela/scripts/` both exist | Next is `/tangela-setup`. Stop here. |
| `.tangela/program.json` exists | No program in this checkout. When the program has its own worktree, run this from there. When `<TANGELA_HOME>/programs/<repo>/archive/` holds an archive, say the last program closed, naming the newest. Either way, next is `/tangela-investigate`, which starts one. Stop here. `TANGELA_HOME` defaults to `~/.claude/tangela`, and `<repo>` is the name of the main checkout's folder. |

Done when both checks pass, or you have stopped with the answer.

## 2. Read the status

Run `node .tangela/scripts/status.mjs`. Its last line counts units by state, ratchets at target and items that need a person. Then read, in the store that `.tangela/program.json` names, `attention.md` for open items, `units.tsv` for each unit's state, `investigations/` for any investigation, and `decisions.tsv` for rulings and for the mode `tangela-plan` chose. Done when you can place the program on the map below.

## 3. Place it on the map

The lifecycle runs once per program:

`/tangela-setup` → `/tangela-investigate` → `/tangela-decide` → `/tangela-plan` → `/tangela-coordinate` → `/tangela-close`

`/tangela-decide` encodes each ruling as it goes. A ruling is **encoded** once `decisions.tsv` has a `note` row for its finding starting `encoded as` or `no check fits`.

Take the first row that matches.

| The store shows | Stage | Next |
| --- | --- | --- |
| No investigation, or one whose `progress.md` has slices not done | investigating | `/tangela-investigate`, which resumes from `progress.md` |
| Findings in `findings.json` with no `ruling` or `default` row in `decisions.tsv` | deciding | `/tangela-decide` |
| No units, and an `include` ruling not yet encoded | encoding | `/tangela-decide`, which resumes at its encode step |
| Every `include` ruling encoded, and no units in `units.tsv` | planning | `/tangela-plan` |
| Units not yet `landed`, `parked` or `dropped`, coordinated mode | running | `/tangela-coordinate`, which resumes from `units.tsv` |
| The same, solo mode | running solo | `/tangela-coordinate`, which works and lands each unit in this session |
| Every unit `landed`, `dropped` or `parked` | closing | `/tangela-close`, once every ratchet is at target in the counts the last landing recorded |

A `parked` unit is waiting on a person. Name it with its attention item, and close only once each parked unit is settled.

**Solo mode.** `tangela-plan` picks it when the units fit one session's budget. `/tangela-coordinate` then works and lands each unit in turn in its own session, with no workers and no launch checks. In coordinated mode it starts workers with the tangela-worker agent instead. Either way, it runs `tangela-work`, `tangela-land` and `tangela-doctor` for you.

Landing routes friction back into the orders and the contract while the program runs. A landing that changes the contract can make `/tangela-setup` worth rerunning; say so when the latest `retros/` file asks for it.

Each landing measures the ratchets with `status.mjs --measure`, so `status.mjs` shows the counts as of the last landing. Read those; leave the measuring to landing.

## 4. Reply

```markdown
**Stage**: <stage>, from <the status line, exactly as printed>
**Next**: <the skill to run>, because <the row that matched>

**Needs you**
- A<n>: <the question>. Settle with: <word> | <word>. Default if unanswered: <what happens>.

**Budget**: <spend> of <budget>. <"Launches have stopped at the orders' stop line." when at or past it>
```

Every open attention item appears in full, with its settle words. Write "none" when there are none. Done when the reply names one next skill and lists every open item.
