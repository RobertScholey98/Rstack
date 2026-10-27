# Rstack

Agent skills for Claude Code and Codex. The first bundle is **tangela**, a method for untangling a codebase that has started to strangle itself. [GLOSSARY.md](./GLOSSARY.md) defines its words.

## Layout

Skills live under `skills/engineering/`:

- `skills/engineering/tangela/<name>/`: skills that only make sense inside a tangela program. Every name starts with `tangela`.
- `skills/engineering/<name>/`: generic skills that stand on their own and that tangela leans on, including the `principle-*` leaves.

A skill is a folder holding `SKILL.md` and `agents/openai.yaml`, with any deeper material in files one level down. The folder name equals the frontmatter `name`: lowercase kebab case, at most 64 characters. Names are unique across the whole repo, because `scripts/link-skills.sh` puts every skill in one flat directory.

Every skill appears in three places:

- the `skills` array in `.claude-plugin/plugin.json`, which Claude Code and Codex both read;
- its bucket's `README.md`;
- the top-level `README.md`.

In each README the skill's name links to its `SKILL.md`, under a **User-invoked** or **Model-invoked** heading. [.agents/invocation.md](./.agents/invocation.md) says which is which, and how one skill calls another.

## Writing a skill

- `SKILL.md` stays at 100 lines or fewer. Detail goes in a file beside it, linked from `SKILL.md`.
- Name a harness feature by what it does, never by one harness's tool name: "ask with the harness's question tool". Claude Code and Codex read the same text.
- Content is project-agnostic. A lesson carries no company, client, product or person names from the work it came from, no paths or IDs from that work, and no figures measured in it. State the lesson on its own.
- When a change adds, renames or removes a tangela skill, or changes where one fits in the lifecycle, update the `tangela` router so its map stays true.
- A skill that starts as a copy of someone else's gets an entry in `NOTICE` with the source, its copyright and its licence. From then on it's ours to edit.

No em dashes anywhere in the repo. Rewrite the sentence with a comma, colon, period or parentheses instead of swapping the character.

## Before committing

- Run `npm run check`. It runs `scripts/check.mjs` and the tests. `check.mjs` fails on a broken rule above: a missing or misgrouped listing, a name that doesn't match its folder, a `SKILL.md` over 100 lines, mismatched invocation flags, a dangling link, an em dash, or versions out of step. It also reads a gitignored `.denylist` when one exists, one term per line, and fails on any match.
- Run `claude plugin validate .` after touching either manifest. It should pass with warnings only about the missing icon and about files inside `node_modules`, which is never committed.
- Run `npx changeset` for any change a plugin user would notice. The release workflow turns changesets into a version PR, and `npm run version` copies the new version into `plugin.json`.

## Local install

`scripts/link-skills.sh` symlinks every skill into `~/.claude/skills` and `~/.agents/skills`, so a `git pull` updates the installed copies. Re-run it after adding, renaming or removing a skill. It's for working on Rstack itself. Everyone else installs the plugin, as [.agents/install-block.md](./.agents/install-block.md) says.

Decisions with a lasting trade-off are recorded in [.agents/adr/](./.agents/adr/).
