# The tangela kit

Scripts that `tangela-setup` copies into a repo's gitignored `.tangela/scripts/` folder (everything here except `test/`). They need Node and git, and nothing else. Each reads the repo contract.

| Script | Does | Exit codes |
| --- | --- | --- |
| `gate.mjs <tier>` | Runs a tier's steps, takes the e2e lock for steps that need it, widens a `unit` gate when the diff touches a shared path, reruns failures alone, and writes `.tangela/logs/last-gate.json` with the commit it gated. | 0 pass, 1 fail, 2 broken setup, 3 load |
| `worktree.mjs <unit>` | Makes a unit's worktree from the right base, copies in the gitignored files it needs and the kit, and gives it a scratch folder and a free port. | 0 ready, 1 made with problems, 2 not made |
| `checks/eol-bom.mjs` | Fails on byte-order marks, UTF-16, CRLF and mixed line endings in staged or named files. `--fix` rewrites them. | 0 clean, 1 problems |

The e2e lock lives at `~/.claude/tangela/locks/e2e`, shared by every checkout on the machine. Set `TANGELA_HOME` to move it.

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
    "ports": [5173, 5180]
  },
  "eol": { "crlf": ["*.cmd"] }
}
```

| Field | Meaning |
| --- | --- |
| `contract` | The format version. This kit reads 1. |
| `defaultBranch` | Where work outside a program starts, and what a `unit` gate diffs against to decide whether to widen. Default `main`. |
| `node` | Optional. The Node version gates should run on. Without it the kit reads `.nvmrc` or `.node-version`. A mismatch is reported, not fatal. |
| `tiers` | The steps for each tier: `commit`, `unit`, `widened`, `merge` and `release`. A gate stops at the first failing step. |
| `widen` | Globs, read like `.gitignore`. When a `unit` gate's diff touches one, the gate runs `widened` instead. |
| `worktree` | How `worktree.mjs` makes a unit's worktree. |
| `eol.crlf` | Globs of files allowed CRLF line endings, on top of `.gitattributes` `eol=crlf`. |

Each step has these fields:

| Field | Meaning |
| --- | --- |
| `name` | Shown in the gate's output and in log file names. |
| `run` | The shell command, run from the repo root. |
| `lock` | `true` takes the machine-wide e2e lock for the step and its reruns. Set it on every step that drives a browser or a shared server. |
| `failures` | A regular expression matching one failed test per line, with its name in the first group. Without it, a failing step shows the end of its log instead. |
| `rerun` | The command that runs one failed test alone, with retries off. `{test}` becomes the test's name, quoted. |
| `repeat` | How many times to rerun each failure alone. Default 3. |

`worktree` has these fields:

| Field | Meaning |
| --- | --- |
| `root` | Where the worktree goes, relative to the current checkout. `{repo}` and `{unit}` are filled in. Default `../{repo}.worktrees/{unit}`. |
| `branch` | The new branch. Default `tangela/{unit}`. |
| `copy` | Gitignored files a worktree needs, such as local env files, copied from the current checkout. A missing one is reported. |
| `install` | The command that installs dependencies in the new worktree. Skipped with `--no-install`. |
| `ports` | `[low, high]`. The first free port that no other worktree of the repo has claimed goes in `.tangela/worktree.json`. |
