# Running a baseline

A baseline measures where the code stands, so later work has numbers to move. It answers five questions, one slice each. In a large codebase, split B2 by area (data and state, UI and routing, tooling and tests), so each sub-agent can read every file in its area. Number the split slices on from the table, as `B6`, `B7` and so on, because a slice ID is a letter and a number.

| Slice | Measures | Recorded as |
| --- | --- | --- |
| `B1` the stack | Each runtime, framework and tool: the version pinned, the current release from the registry (with the date you checked), majors behind, and what changed upstream that this code would use. Dependencies with no imports, and ones in the wrong dependency group. | a version table |
| `B2` ways per concern | For each concern (data access, errors, client state, forms and validation, routing, UI primitives, styling, icons, formatting, test rendering and mocking): every distinct way the code does it, with a site count for each. | a table of concern, ways, sites |
| `B3` counts | Every count a rule could later hold down, each with the exact command that prints it as one integer: linter warnings, suppression comments, type escapes, files left in a folder being retired, hand-written types a generator should own, entry bundle size, and the errors a stricter compiler flag would raise in a dry run. | ratchet candidates |
| `B4` slow loops | The wall time of typecheck, lint, unit tests, build, the end-to-end suite and the commit hook, cold and warm, and what the hook runs on every commit. | a timing table |
| `B5` hot files | The files most changed in recent history (`git log --since=<months> --name-only`), the largest files, and the files most others import. | a ranked list |

## The measurement brief

Each B slice gets the same opening as [SWEEP-BRIEF.md](SWEEP-BRIEF.md) (read-only, the base, the skip list, `files_read`), its own row from the table above, and these rules:

- Measure in the code at the base. A number from a README, a memory note or a package manifest is a lead to check, and a check that disagrees with it is itself worth recording.
- Give every number the command or search that produced it, so a later count is taken the same way.
- Call a dependency or file unused only after searching every way it could be loaded: static imports, dynamic imports, config files and string references. Where loading is dynamic, say the claim needs a runtime check.
- Record problems seen in passing as `candidates`, in the sweep's shape.

The output adds `measurements` to the sweep's slice file:

```json
{
  "slice": "B3",
  "files_read": ["package.json"],
  "measurements": [
    { "name": "lint warnings", "value": 500, "command": "npx eslint . -f json | node -e \"...\"", "note": "warnings only; errors are 0" }
  ],
  "candidates": []
}
```

## Merging

1. Re-derive any surprising number yourself with its command before it goes into `baseline.md`.
2. Turn each concern done more than one way into a `structural` finding whose question asks which way wins. Turn each slow loop that runs on every commit into a `tooling` finding. Check the B slices' candidates against the code, then add them.
3. For each count that a ruling could hold down, add a row to the store's `ratchets.tsv`: `name`, `baseline` and `count` both today's value, `target` (usually 0), `measured` today's date, and `command`. Write the row with the file-editing tool, tab-separated, in the column order the file's header gives.

## baseline.md

The measurements, in the five tables above, then the ratchet candidates: name, today's count, target, command.

## report.md

1. **The ecosystem gap**: the version table, and the upstream shifts that matter here.
2. **What the code does today**, by area, each claim checked in the code.
3. **What is sound**, so the decisions that follow keep it.
4. **Recommendation**, in tiers: fix now (bugs and dead weight found in passing), close the toolchain gap, adopt the patterns the ecosystem settled on, and what not to chase here, each with its reason.
5. **If you only do three things**: each with the number that shows it worked.
