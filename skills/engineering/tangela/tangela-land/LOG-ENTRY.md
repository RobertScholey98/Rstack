# The landing log entry

Write this to `<log>/<program>/<unit>.md` for each landed unit. One file per unit keeps the log mergeable and short to read. The counts come from `status.mjs --measure` at landing time, never copied from an older entry. Every claim is a fact. Leave out a section only when it would be empty.

```markdown
# <unit>: <title>

Landed <YYYY-MM-DD> as <short sha> on `<integration branch>`. Program <program>, orders version <n>.

## Outcome

<What is true in the code now that wasn't before, in two or three sentences for someone reading the codebase a year from now. Or "No change", with the evidence.>

## Rulings carried out

- <ruling or finding ID>: <the ruling, in one line>

## Proof

- **Merge tier**: <the verdict line, exactly as printed>
- **Pinned**: <tests or snapshots that held the behaviour while it changed>
- **Proved red**: <tests that failed on the old code>
- **Pending marks flipped**: <marks>

## Ratchets

| Ratchet | Before | After | Target |
| --- | --- | --- | --- |
| <name> | <count> | <count> | <target> |

## Review

<Reviewers and their models. Findings applied, with commits. Findings rejected, each with its reason.>

## Follow-ups

- <what was left, and where it went: a unit id, an attention ID, or a commit>
```
