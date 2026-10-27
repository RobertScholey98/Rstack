# The tangela kit

Scripts that `tangela-setup` copies into a repo's gitignored `.tangela/scripts/` folder (everything here except `test/`), with a `kit.json` naming the plugin version they came from. They need Node and git, and nothing else. Each reads the repo contract.

| Script | Does | Exit codes |
| --- | --- | --- |
| `gate.mjs <tier>` | Runs a tier's steps, takes the e2e lock for steps that need it, widens a `unit` gate when the diff touches a shared path (diffed against `--base`, else the base the worktree recorded, else the default branch), reruns failures alone, and writes `.tangela/logs/last-gate.json` with the commit it gated. | 0 pass, 1 fail, 2 broken setup, 3 load |
| `worktree.mjs <unit>` | Makes a unit's worktree from the right base, copies in the gitignored files it needs and the kit, and gives it a scratch folder and a free port. Ends with `WORKTREE READY <path>`. | 0 ready, 1 made with problems, 2 not made |
| `worktree.mjs --remove <unit>` | Deletes a unit's worktree, then its branch if nothing on it is unmerged. Run it from another checkout. | 0 removed, 2 nothing to remove |
| `checks/eol-bom.mjs [files] [--all]` | Fails on byte-order marks, UTF-16, CRLF and mixed line endings in staged or named files, or in every tracked file with `--all`. `--fix` rewrites them. | 0 clean, 1 problems |
| `checks/pending-marks.mjs` | Fails on a pending mark that names a landed unit, or a unit `units.tsv` doesn't have, with its file and line. | 0 clean, 1 problems, 2 no `marks` in the contract or no program |
| `checks/drift.mjs [files]` | Finds one normative line (must, never, always, don't, only) stated in two steering files. | 0 clean, 1 drift |
| `checks/doc-paths.mjs [files]` | Finds relative links and inline-code paths in markdown that don't exist, skipping the contract's `log` folder. | 0 clean, 1 dead paths |
| `program.mjs` | Prints the program this checkout belongs to: its name, store, integration branch and orders version. | 0 shown, 2 `PROGRAM NONE` |
| `program.mjs init <name> [--branch <b>]` | Makes the program's store at `<TANGELA_HOME>/programs/<repo>/<name>/` from `templates/`, and points the checkout at it with `.tangela/program.json`. Refuses a checkout that already has a program, an existing store, or a branch that doesn't exist. Ends with `PROGRAM READY <store>`. | 0 ready, 1 refused |
| `program.mjs branch <b>` | Sets the program's integration branch. Ends with `PROGRAM BRANCH <b>`. | 0 set, 1 refused |
| `program.mjs unit <id> <field>=<value>...` | Sets fields on a unit's row in `units.tsv`, adding the row if it's new. Accepts the table's columns apart from `id` and `updated`. Ends with `UNIT <id> <state>`. | 0 set, 1 refused |
| `program.mjs log <kind> <ref> "<decision>" [--why ".."] [--evidence ".."] [--by <who>]` | Appends one row to `decisions.tsv`. `kind` is one of `ruling default orders launch land park finding note`, and `by` defaults to `coordinator`. Ends with `LOGGED <kind> <ref>`. | 0 logged, 1 refused |
| `program.mjs archive` | Moves the store to `programs/<repo>/archive/<name>-<date>/` and removes `.tangela/program.json`. Ends with `PROGRAM ARCHIVED <path>`. | 0 archived, 1 refused |
| `status.mjs [--write] [--measure]` | Prints the orders version, units by state, ratchets against baseline and target, open attention items, and spend against the budget (naming each launched unit with blank spend as unknown, not zero), saying to stop launching once spend reaches the orders' stop line (`- Stop launching at: <n>%`, 70% when absent). `--measure` reruns each ratchet's command and records the count. `--write` also writes the store's `status.md`. Ends with `STATUS ...`. | 0 printed, 1 a ratchet command didn't print one integer, 2 no program |
| `doctor.mjs [--launch]` | One line per check: Node, the hook block (in the `core.hooksPath` folder, the folder above it as husky lays it out, or a hook manager's config file at the repo root), the kit version, the e2e lock, the contract's ports, and machine load. Commits on the integration branch since the last landing that no unit made, and drift, print as `NOTE` lines for the doctor skill to judge; they aren't problems. `--launch` also weighs the running units and the load against the orders' Concurrency section. | 0 `DOCTOR OK`, 1 `DOCTOR PROBLEMS`, 2 broken, 3 `DOCTOR HOLD` |
| `report-facts.mjs [--base <ref>]` | From a unit's worktree, prints markdown for the unit report: commits since the base, files changed, tests added or changed, pending marks flipped and still pending, and the last gate's verdict with whether it gated HEAD. Ends with `FACTS <n> commits`. | 0 printed, 2 broken |
| `prove-red.mjs --run "<cmd>" <file>... [--base <ref>]` | Checks that the command passes now, swaps the named files for their versions at the base, and runs it again. It always restores the files. Refuses files with uncommitted changes, or files new since the base. | 0 `RED PROVEN`, 1 `NOT RED`, 2 broken |
| `land.mjs <unit> [--no-review-gate]` | From the integration branch with a clean tree: merges the unit's branch with `--no-ff`, fixes line endings and byte-order marks, refuses while a pending mark names the unit, runs `commit`, commits (one retry if the hook changed files), runs `merge`, then sets the unit `landed` and logs a `land` row. Needs the unit `reported` unless `--no-review-gate`. A failed `merge` tier keeps the commit, records nothing and prints the undo line. | 0 `LAND DONE`, 1 `LAND CONFLICT` or `LAND FAIL`, 2 `LAND REFUSED`, 3 `LAND LOAD` |

`templates/` holds the program store's starting files, which `program.mjs init` copies. `worktree.mjs` copies `.tangela/program.json` into each unit's worktree along with the kit, so every script finds the same store.

The e2e lock lives at `~/.claude/tangela/locks/e2e`, shared by every checkout on the machine. Set `TANGELA_HOME` to move it, and the program stores with it.

## The repo contract

`tangela-setup` writes the contract to `docs/agents/tangela.md` and commits it. Its prose is for people and agents. The kit reads one fenced block from it, tagged `json tangela`:

```json tangela
{
  "contract": 1,
  "defaultBranch": "main",
  "tiers": {
    "commit": [{ "name": "typecheck", "run": "npm run typecheck" }],
    "unit": [
      { "name": "unit tests", "run": "npm test", "failures": "^\\s*FAIL\\s+(.+)$" },
      {
        "name": "e2e for touched features",
        "run": "npm run e2e:changed",
        "lock": true,
        "failures": "^\\s+\\d+\\) (.+)$",
        "rerun": "npx playwright test -g {test} --retries=0"
      }
    ],
    "widened": [
      { "name": "unit tests", "run": "npm test" },
      { "name": "e2e, all of it", "run": "npm run e2e", "lock": true }
    ],
    "merge": [
      { "name": "everything", "run": "npm run verify" },
      { "name": "e2e, all of it", "run": "npm run e2e", "lock": true }
    ]
  },
  "widen": ["src/app/**", "src/shared/**", "package.json", "vite.config.*"],
  "worktree": {
    "copy": [".env.local"],
    "install": "npm ci",
    "ports": [3000, 3009]
  },
  "eol": { "crlf": ["*.cmd"] }
}
```

| Field | Meaning |
| --- | --- |
| `contract` | The format version. This kit reads 1. |
| `defaultBranch` | Where work outside a program starts, and what a `unit` gate diffs against to decide whether to widen. Default `main`. |
| `node` | Optional. The Node version gates should run on: a version or the start of one, such as `"24"` or `"24.13"`. A range like `^24.13.1` is refused. Without it the kit reads `.nvmrc` or `.node-version`. A mismatch is reported, not fatal. |
| `tiers` | The steps for each tier: `commit`, `unit`, `widened`, `merge` and `release`. A gate stops at the first failing step. |
| `widen` | Globs, read like `.gitignore`. When a `unit` gate's diff touches one, the gate runs `widened` instead. |
| `worktree` | How `worktree.mjs` makes a unit's worktree. |
| `log` | The folder for landing entries, one file per unit. Default `docs/tangela/log`. `doctor.mjs` treats commits that touch only this folder as the landings' own. |
| `marks` | Optional. `{ "pattern": "<regex>", "paths": [globs] }`. The pattern finds a pending mark, with the unit id in its first group, and `paths` limits which tracked files are searched (default all). Read by `checks/pending-marks.mjs`, `land.mjs` and `report-facts.mjs`. |
| `eol.crlf` | Globs of files allowed CRLF line endings, on top of `.gitattributes` `eol=crlf`. |

Each step has these fields:

| Field | Meaning |
| --- | --- |
| `name` | Shown in the gate's output and in log file names. |
| `run` | The shell command, run from the repo root. |
| `lock` | `true` takes the machine-wide e2e lock for the step and its reruns. Set it on every step that drives a browser or a shared server. |
| `failures` | A regular expression matching one failed test per line, with its name in the first group. Without it, a failing step shows the end of its log instead. |
| `rerun` | The command that runs one failed test alone, with retries off. `{test}` becomes what `failures` captured, quoted: a test's name, or its file when the runner reruns by file. Runs from the repo root, so in a monorepo give each package its own step. |
| `repeat` | How many times to rerun each failure alone. Default 3. |

`worktree` has these fields. Each is optional, and so is `worktree` itself:

| Field | Meaning |
| --- | --- |
| `root` | Where the worktree goes, relative to the current checkout. `{repo}` and `{unit}` are filled in. Default `../{repo}.worktrees/{unit}`. |
| `branch` | The new branch. Default `tangela/{unit}`. |
| `copy` | Gitignored files a worktree needs, such as local env files, copied from the current checkout. A missing one is reported. Default none. |
| `install` | The command that installs dependencies in the new worktree. Skipped with `--no-install`, or when absent. |
| `ports` | `[low, high]`. Without it, the worktree gets no port. The first free port that no other worktree of the repo has claimed goes in `.tangela/worktree.json`. A repo that needs several ports per checkout derives them from this one, with an offset, and says how in the contract's prose. |
