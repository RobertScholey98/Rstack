---
name: principle-one-home-one-writer
description: Each rule has one source, and each shared file has one writer. Use when adding a rule to a steering file, deciding where a fact or rule belongs, or when more than one agent could write the same file.
---

# One home, one writer

Each rule lives in one place, and every other place points to it. Each file that several agents need has one writer, and the rest send that writer what they'd change.

## Why

A rule stated in two files drifts. One copy is updated and the other isn't, and an agent that reads both obeys whichever it read last. A rule with no home gets typed again into every prompt and every summary, and one retelling drops it.

A file that several agents append to becomes a merge conflict at every landing, resolved by hand each time. A scratch folder that several agents share gets one agent's file committed or run by another.

## Apply it

**For a rule**, put it where its kind lives, and replace every copy with a pointer:

| The rule is about | Its home |
| --- | --- |
| how to work, in any repo | a skill |
| this repo: commands, paths, ports | the repo's contract or agent rules |
| this machine | a machine-notes file outside version control |
| this program only | the program's orders |
| what the code should look like | the repo's conventions or ADRs |

When you catch yourself writing a rule a second time, find its home and point at it. When two copies already disagree, ask whoever owns the rule which is right, fix the home, and delete the other.

**For a shared file**, name its one writer. Everyone else puts the change they'd make in their report, and the writer applies it. Shared logs, status files and indexes are the usual cases. Give each agent a scratch folder of its own.

## Check it

`node .tangela/scripts/checks/drift.mjs` finds one rule stated in two steering files. `worktree.mjs` gives each unit its own scratch folder. Who writes each shared file is a line in the program's orders.
