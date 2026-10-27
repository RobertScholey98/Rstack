# The unit report

Fill this in and hand it back as your final message. Leave out a section only when it would be empty, and say "none" for a table with no rows. Every claim names its evidence: a commit, a test name, a log path or a number.

```markdown
# Report: <unit>

**Outcome**: done | partly done | no change, with evidence
**Orders followed**: version <n>
**Gate**: <the verdict line, exactly as printed>

## Commits

| Commit | Step |
| --- | --- |
| <short sha> | <one line> |

## Proof

- **Pinned**: <test or snapshot>, passing before the change and after it.
- **Proved red**: <test>, which failed on the old code with "<the failing line>" and passes now.
- **Pending marks flipped**: <marks>. None the brief names are left.

## Failures classified

| Test | Class | Evidence |
| --- | --- | --- |
| <name> | load, pre-existing or real | <the rerun result, or the base's result> |

## Decisions taken

- <what you decided>, because <why>. Reverse it with: <the one word or line that would>.

## For a person

- <anything that needs a human>, with the one word that settles it.

## Left undone

- <what's left, and why>, if the outcome isn't "done".

## Friction

- <time lost to the environment or the tools, and what caused it>, one line each, for the retro.
```
