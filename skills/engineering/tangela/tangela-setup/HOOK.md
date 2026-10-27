# The hook block

Add this to the end of the repo's pre-commit hook. Git runs a pre-commit hook from the top of the checkout, so the relative paths hold.

```sh
# tangela: the kit's checks run only where the kit is installed.
# See docs/agents/tangela.md.
if [ -f .tangela/scripts/checks/eol-bom.mjs ]; then
  node .tangela/scripts/checks/eol-bom.mjs || exit 1
else
  echo "tangela: no kit in this checkout, so its checks were skipped"
fi
```

The check reads the staged files, so it sees what the commit will hold, not the working tree.

## Where it goes

| The repo has | Do |
| --- | --- |
| A hooks folder named by `core.hooksPath`, committed | Append the block to that folder's `pre-commit`. |
| A hook manager that generates the `core.hooksPath` folder when dependencies install, so the folder is gitignored | Append the block to the committed `pre-commit` script the manager runs, not to the generated folder. In a fresh clone `core.hooksPath` is unset until the install runs. |
| A hook manager configured in a file | Add a pre-commit command that runs the block, in the manager's own config format. Keep the guard. |
| Only `.git/hooks`, or nothing | Create `.githooks/pre-commit` holding `#!/bin/sh` and the block, commit it, and run `git config core.hooksPath .githooks`. Say in the contract that each clone runs that once. |

A hook runs with the PATH of whatever started the commit. When a version manager puts Node on the PATH only in some shells, a commit from another shell dies with "command not found" (exit 127). Write in `.tangela/machine.md` how each shell gets Node.

A hook file needs LF line endings and the executable bit, on every platform. On Windows, set the bit in git with `git update-index --chmod=+x <file>`.

Don't add the gate's `commit` tier to the hook. That tier lists what the hook already runs, so the gate can rerun the same checks on demand.
