# Rstack

Agent skills for Claude Code and Codex.

The first bundle is **tangela**, a method for untangling a codebase that has started to strangle itself. Survey the tangle, decide what the code should look like, turn each decision into a check that fails, cut the work into units, run them, and land each one behind a gate. It scales from one session to a set of agents working in parallel under a coordinator.

tangela leans on a set of generic engineering skills, which also work on their own. [GLOSSARY.md](./GLOSSARY.md) defines the words the skills use.

## Install

Install the plugin or link the skills, never both, or every skill appears twice.

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugin marketplace add RobertScholey98/Rstack
claude plugin install rstack@rstack
```

A marketplace you add yourself doesn't update on its own by default. Update with `claude plugin update rstack@rstack`, or turn on auto-update for the `rstack` marketplace in `/plugin`.

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
codex plugin marketplace add RobertScholey98/Rstack
codex plugin add rstack@rstack
```

Codex reads `.claude-plugin/` when a repo has no `.codex-plugin/`, and updates at startup.

</details>

## tangela

The skills for running a program, from setup to close. Listed in [skills/engineering/tangela](./skills/engineering/tangela/README.md).

### User-invoked

None yet.

### Model-invoked

None yet.

## Engineering

Generic skills tangela leans on, including the `principle-*` leaves. Listed in [skills/engineering](./skills/engineering/README.md).

### User-invoked

None yet.

### Model-invoked

None yet.

## Credits

Rstack is modelled on two libraries: [Matt Pocock's skills](https://github.com/mattpocock/skills), for the layout, the invocation rules and the grilling, design, testing and review skills, and poteto's [pstack](https://github.com/cursor/plugins/tree/main/pstack), for principle leaves and for running a program of agents.

## Licence

[MIT](./LICENSE)
