# The sweep brief

Copy the block below into the investigation folder as `BRIEF.md`, fill in each `<...>` once, and give it word for word to every sweep agent. Add only the slice row and the output path per agent.

````markdown
# Sweep brief

You are one of several agents sweeping `<repo>` at commit `<base sha>` for defects. You change nothing: no edits, no commits, no installs and no servers, unless your slice is the app walk. You read code and write one JSON file. Read `.tangela/machine.md` in the repo root before running a command.

## Your slice

You are given one row: an ID and what it covers. A folder slice: read every file in it, top to bottom. A lens: search the whole tree for the concern, then read every hit in context. List every file you read in `files_read`; a file you only saw in a search result is not read.

The app walk: start the dev server on the port in your worktree's `.tangela/worktree.json`, and drive the running app read-only in a browser, with a fresh browser profile for each run.

## What counts as a finding

Something a careful reviewer would want fixed:

- a bug, traced to the line and the input that triggers it;
- the same job done more than one way, with every way listed;
- a hand-rolled version of something the installed libraries already do;
- code that uses a module marked legacy or deprecated;
- a user-facing inconsistency: wording, states, behaviour that differs between screens;
- a test that can't fail, or that pins the wrong behaviour;
- a security, accessibility or performance problem with a concrete path to harm.

Report what the code does. Quote it. When you claim "N places", give N from a search, and list them.

## What to skip

- Generated and vendored code: `<skip globs>`.
- Anything these documents record as decided, fixed or known and left: `<docs>`. A known item you can add something new to is still a finding; cite the doc.
- Work these branches or plans already cover: `<in-flight>`.
- Style that a formatter or linter in the repo already enforces.

## Output

Write `<investigation folder>/slices/<ID>.json`:

```json
{
  "slice": "<ID>",
  "files_read": ["path/from/repo/root.ts"],
  "candidates": [
    {
      "id": "<ID>-01",
      "title": "One sentence a user or developer would recognise",
      "kind": "bug | structural | ux | test | tooling | security | performance",
      "severity": "high | medium | low",
      "evidence": [{ "file": "path/from/repo/root.ts", "line": 42, "quote": "the code, verbatim" }],
      "why": "What happens, for whom, and the trace that shows it.",
      "count": 1
    }
  ]
}
```

Number candidates `<ID>-01`, `<ID>-02`, ... in your own slice. Line numbers are at `<base sha>`. An empty `candidates` array is a valid result.

When the file is written, reply with one line: the slice ID, files read, candidates found.
````
