# The files that carry a finding

Three files carry a finding from a sub-agent's claim to a numbered result. `investigation.mjs check` enforces the last one.

## slices/\<ID\>.json

One sub-agent's raw output: `slice`, `files_read` and `candidates`, as [SWEEP-BRIEF.md](SWEEP-BRIEF.md) shows. A baseline slice adds `measurements`, as [BASELINE.md](BASELINE.md) shows, and its `candidates` are the problems it saw in passing.

## verify/\<ID\>.json

A verifier's verdict on every candidate in one slice:

```json
[
  { "id": "S03-04", "verdict": "confirmed", "note": "Traced: the handler receives undefined and the formatter throws." },
  { "id": "S03-05", "verdict": "corrected", "note": "8 places, not 10.", "corrected": { "count": 8 } },
  { "id": "S03-06", "verdict": "false-positive", "note": "The button defaults to type=button." },
  { "id": "S03-07", "verdict": "duplicate", "of": "X1-02" }
]
```

`verdict` is one of `confirmed`, `corrected`, `false-positive` or `duplicate`.

## findings.json

The merged, deduplicated result: a JSON array, one object per finding.

```json
{
  "id": "QA-001",
  "title": "Clicking the selected day in a date picker crashes the screen",
  "kind": "bug",
  "severity": "high",
  "effort": "S",
  "evidence": [
    { "file": "src/ui/DatePicker.tsx", "line": 31, "quote": "onSelect={(day) => setValue(format(day))}" }
  ],
  "why": "The picker deselects on a second click and passes undefined, which the formatter turns into an invalid date and throws in render. Reproduced in the app.",
  "question": "Fix it now in one shared picker, or leave it for later?",
  "slices": ["S03", "X1"]
}
```

| Field | Holds |
| --- | --- |
| `id` | `<PREFIX>-<nnn>`. One prefix per investigation, chosen to tell it from earlier ones. |
| `title` | One sentence in the words of the person who would notice it. |
| `kind` | `bug`, `structural`, `ux`, `test`, `tooling`, `security` or `performance`. |
| `severity` | `high`, `medium` or `low`, by what it costs users today. |
| `effort` | `S` (an hour or two), `M` (a day or so), `L` (more, or several units). |
| `evidence` | Every place, each with the file, the line at the base and the code quoted. |
| `why` | What happens, to whom, and how it was checked: traced, recounted, or reproduced. |
| `question` | The one ruling a person must make, ending in a question mark. |
| `slices` | The slice IDs whose candidates it came from. |

## The question

`tangela-decide` asks it, so write it as a choice a person can answer in a word or two, with your recommendation first. Name the real fork:

- For a plain bug, the fork is when: "Fix it now, or leave it for later?"
- For many ways of doing one job, the fork is which way wins: "Keep the shared formatter and delete the other ten, or keep two?"
- For a missing decision, name the options: "Should a not-found record show the not-found page, or an inline message?"

A finding whose only honest question is "is this true?" isn't verified yet. Verify it before it goes in.
