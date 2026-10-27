# Running a sweep

A sweep is a report-only hunt for defects. It changes no code. Its findings feed `tangela-decide`, so each one has to survive a person asking "are you sure?".

## Slicing

List every hand-written file at the base with its line count (`git ls-tree -r --name-only <base>`, minus `Skip`). Cut three kinds of slice:

- **Folders** (`S01`, `S02`, ...): source folders, split or grouped until each slice is a few thousand lines. Give config, scripts, pipelines and build files a slice of their own.
- **Tests** (`T1`, ...): the test and story files, by folder. Tests get their own slices because a folder sweep reads them last and least.
- **Lenses** (`X1`, ...): one concern across the whole tree. A folder sweep sees one way of formatting dates per folder; a lens sees that every folder does it differently. Start from these and add the repo's own:

| Lens | Looks for |
| --- | --- |
| Formatting | dates, times, numbers, money, percentages: how many ways, and which are wrong |
| Dialogs and feedback | modals, sheets, toasts, confirmations, success and failure messages |
| Tables and filters | grids, columns, pagination, search inputs, filter state |
| Loading, empty and error states | spinners, skeletons, fallbacks, error pages, not-found handling, redirects |
| Permissions and URLs | role checks, guards, hand-built links, search params, deep links |
| Data access | query keys, cache invalidation, retries, form submission |
| Accessibility, security, performance | keyboard reach, labels, unsanitised HTML, message origins, needless work |
| The tests themselves | tests that can't fail, fixed waits, leaking mocks, snapshot-only specs |

When the app can run on this machine, add a lens for **the running app**, the **app walk**. It is the one slice that starts a server, so it runs differently. Make it a worktree with `node .tangela/scripts/worktree.mjs app-walk --base <base sha>`, which records a free port, and start a worker with the tangela-worker agent there, since it has the browser and shell tools the tangela-explorer agent lacks. Its prompt says it is a sweep agent following `BRIEF.md`, not a unit worker, so it commits nothing. Remove the worktree with `node .tangela/scripts/worktree.mjs --remove app-walk` once its slice file is written. The walk itself is read-only: sign in as each kind of user through whatever test sign-in the repo provides, navigate by URL only, and include deliberate bad paths (unknown routes, another role's pages, malformed and missing ids). On each page record the final URL, the title, messages shown, console errors and failed requests, and take a screenshot. Use a fresh browser profile for every run: a reused profile carries one user's session into the next and produces false findings. Stop the server and the browser when done.

## The brief

Copy [SWEEP-BRIEF.md](SWEEP-BRIEF.md) into the investigation as `BRIEF.md` and fill in its blanks once. Every sweep agent gets the same brief, so their output merges without translation.

## Verifying

A sweep agent's candidate is a claim. Before it becomes a finding, a second agent checks it against the code. Batch the swept slices by area, a few slices per batch, and start one verifier per batch with the tangela-reviewer agent, which writes only the output file its prompt names. On a harness without that agent, ask in the spawn prompt for opus at medium effort, and add "Read `.tangela/machine.md` in the repo root before running a command." Each verifier gets:

- the candidates, from `slices/<ID>.json`;
- the base commit;
- this instruction: trace each bug claim concretely, step by step through the code; check library behaviour in the installed dependency's own source, never from memory; recount every "N places" claim with a search; and give each candidate one verdict, written to `verify/<ID>.json` as [SCHEMA.md](SCHEMA.md) shows.

Re-derive every high-severity bug yourself, and reproduce it in the running app where you can. A verifier tracing on paper can be wrong in the same way the sweeper was.

`investigation.mjs next` counts a slice as done only when every candidate it raised has a verdict.

## Merging

1. Drop the `false-positive` verdicts. Take the corrected text for `corrected` ones.
2. Cluster candidates that share a root cause into one finding: the same hand-rolled pattern in nine files is one finding with nine evidence items. Cluster across slices too, since lenses and folders find the same thing.
3. Set the severity by what it costs users today: `high` for broken behaviour users hit, data shown wrong, or a security hole; `medium` for inconsistency or structure that costs every change; `low` for tidying.
4. Write the one question each finding asks of a person (see SCHEMA.md).
5. Number the findings by severity, then by how far the pattern spreads, with one prefix for the whole investigation.

Keep a finding that in-flight work already covers out of `findings.json`, and list it in the report under "Left out", with the branch or plan that covers it.

## report.md

The summary a person reads. In this order:

1. **Summary**: a few paragraphs. What is sound, what isn't, the high findings in plain words, and the patterns that recur.
2. **Top ten**: ranked by what each costs users today, then by how far it spreads, one line each on why.
3. **Quick wins**: findings with small effort, low risk and no dependency on other work.
4. **Themes**: findings grouped by the area or root cause they share.
5. **Method**: the base, files read against files at the base, the slices, the verification, and what the app walk confirmed or ruled out.
6. **Left out**: generated code, in-flight work, and documented decisions, each with its reason.
