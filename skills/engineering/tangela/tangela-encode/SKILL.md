---
name: tangela-encode
description: Turn a tangela ruling into a check that fails the build, and record its baseline and legacy violators. Use when a tangela program has just made a ruling, or when a tangela ruling lives only in prose.
---

# tangela-encode

A rule in a document is a wish; agents follow what fails the build. Turn one ruling into the strongest check that fits it, prove the check fails, and record where the code stands against it.

## 1. Choose the check

| The ruling says | Encode it as |
| --- | --- |
| Code here may not import code there | A lint zone (import-path restriction) at error. |
| Use this module or helper, not that one | A restricted import at error, its message naming the replacement and the ADR. |
| Every caller must give X | A required type or prop, or a stricter compiler flag, so the compiler lists every site. |
| Retire a pattern that has many sites today | A lint rule at warning, held by a ratchet on the warning count. |
| A count no linter sees (suppression comments, files in a retired folder, bundle size, unused exports) | A check script that prints one integer, held by a ratchet. |
| This behaviour is known to be wrong | A pending mark. Load the "principle-marks-are-the-finish-line" skill. |
| A shape or wording no tool can check | A convention entry with an example, and a line in the review checklist. |

When the repo has no rule engine, a lint row above becomes a check script: a small script the `commit` tier runs, which fails when the count is over its limit and prints the count as one integer, so the ratchet's command can run it too.

Prefer an error to a ratchet when the sites are few enough to fix in the same commit. A lint zone states what tests, test helpers and the app's routing primitives may import, since those cross every boundary.

Done when the check's form is chosen and named.

## 2. Write it and prove it fails

Add the rule where the repo keeps its rules, with a comment naming the ADR or convention that justifies it. Then plant one violation, run the rule, and copy the failing line. Remove the violation.

Done when you hold the failing line from the planted violation.

## 3. Record the baseline

Load the "principle-ratchets-only-go-down" skill when the check is a ratchet. Then:

- Write the command that prints today's count as one integer, and run it. Take the count from the command, never from an estimate.
- Count the rule's suppressions too (inline disable comments, ignore entries), with the same care: a ratchet on warnings alone stops seeing every site someone silenced.
- Make the gate fail when the count rises above the recorded number: the linter's maximum-warnings flag, or the check script's own exit code. Then run the commit tier: `node .tangela/scripts/gate.mjs commit`.
- Add or update the row in the store's `ratchets.tsv`: `name`, `baseline` and `count` today's value, `target`, `measured` today's date, `command`. Update the row an investigation already proposed under the same name.

Done when the gate passes at today's count and `ratchets.tsv` holds the row.

## 4. Record the legacy violators

- **A handful of sites**: give each an ignore entry, with a comment naming the finding it belongs to, so the unit that fixes the finding finds them by searching for its ID.
- **Many sites**: the ratchet count is the record, and the rule's own output lists them. Keep no copy of the list.
- **A known-wrong behaviour**: a pending mark needs its unit's id from `units.tsv`. When no unit exists for it yet, write no mark. Log `node .tangela/scripts/program.mjs log note <finding ID> "encoded as pending marks, waiting for a unit"` and say so in your reply. `tangela-plan` searches for that row and loads this skill again with the unit id.

Done when every site the rule flags today is covered by the count, an ignore entry, or a pending mark.

## 5. Commit and log

Commit the rule, its config and any ignore entries as one commit through the repo's hook, in the checkout of the program's integration branch. Then log it:

```bash
node .tangela/scripts/program.mjs log note <finding ID> "encoded as <the check>" --evidence "<the failing line>; <the commit>"
```

Done when the commit has passed the hook and the command printed `LOGGED note <finding ID>`.

## Reply

Report: the ruling, the check and where it lives, the failing line, the count and the command, the violators recorded, and the commit.
