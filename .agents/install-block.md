# The install block

One install story, worded once. `README.md` copies these blocks as they are. Change them here first.

Install the plugin or link the skills, never both, or every skill appears twice.

## Claude Code

```bash
claude plugin marketplace add RobertScholey98/Rstack
claude plugin install rstack@rstack
```

A marketplace you add yourself doesn't update on its own by default. Update with `claude plugin update rstack@rstack`, or turn on auto-update for the `rstack` marketplace in `/plugin`.

## Codex

```bash
codex plugin marketplace add RobertScholey98/Rstack
codex plugin add rstack@rstack
```

Codex reads `.claude-plugin/` when a repo has no `.codex-plugin/`, and updates at startup.

## Working on Rstack itself

```bash
git clone https://github.com/RobertScholey98/Rstack.git
cd Rstack
scripts/link-skills.sh
```

This symlinks each skill into `~/.claude/skills` and `~/.agents/skills`, so `git pull` updates them. On Windows, run it from Git Bash with Developer Mode on, so it can make real symlinks.
