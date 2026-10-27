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

- **[tangela-work](./skills/engineering/tangela/tangela-work/SKILL.md)**: The contract a worker follows to finish one unit: pin behaviour, prove tests red, commit one step at a time, verify through the gate and report facts.
- **[tangela-verify](./skills/engineering/tangela/tangela-verify/SKILL.md)**: Run a verification tier through the kit's gate, and classify each failure as load, pre-existing or real before acting on it.

## Engineering

Generic skills tangela leans on, including the `principle-*` leaves. Listed in [skills/engineering](./skills/engineering/README.md).

### User-invoked

- **[grill-me](./skills/engineering/grill-me/SKILL.md)**: A relentless interview to sharpen a plan or design, one question at a time.
- **[grill-with-docs](./skills/engineering/grill-with-docs/SKILL.md)**: The same interview, which also writes the glossary and ADRs as decisions settle.
- **[retro](./skills/engineering/retro/SKILL.md)**: Review a coding session and suggest improvements to the agent's environment: checks, standards, steering files and tooling.

### Model-invoked

- **[grilling](./skills/engineering/grilling/SKILL.md)**: Interview the user one question at a time until a plan is settled.
- **[domain-modeling](./skills/engineering/domain-modeling/SKILL.md)**: Build and sharpen a project's domain model: challenge terms, test them against scenarios, and update `GLOSSARY.md` and ADRs inline.
- **[codebase-design](./skills/engineering/codebase-design/SKILL.md)**: The vocabulary for designing deep modules: small interfaces at clean seams, testable through the interface.
- **[tdd](./skills/engineering/tdd/SKILL.md)**: Test-driven development with a red-green-refactor loop, one vertical slice at a time, at seams agreed up front.
- **[code-review](./skills/engineering/code-review/SKILL.md)**: Review a diff on two axes in parallel: Standards (the repo's documented standards plus a code-smell baseline) and Spec (does it do what the spec asked).

## Credits

Rstack is modelled on two libraries: [Matt Pocock's skills](https://github.com/mattpocock/skills), for the layout, the invocation rules and the grilling, design, testing and review skills, and poteto's [pstack](https://github.com/cursor/plugins/tree/main/pstack), for principle leaves and for running a program of agents.

The engineering skills above started as copies of Matt Pocock's, under MIT, and have changed since. [NOTICE](./NOTICE) lists them.

## Licence

[MIT](./LICENSE)
