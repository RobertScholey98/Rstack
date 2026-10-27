# User-invoked and model-invoked skills

Every skill is one of two kinds, set by who can reach it.

- **User-invoked**: only a person typing its name can run it. Set `disable-model-invocation: true` in the `SKILL.md` frontmatter, and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Its `description` is a one-line summary for a person browsing commands, with no trigger list.
- **Model-invoked**: the model can reach for it, and so can a person. Leave both flags out. Its `description` says what the skill does, then "Use when" and the situations that should fire it.

Keep the two flags in step, so a skill is user-invoked in both harnesses or in neither. `scripts/check.mjs` fails on a mismatch.

The test for model-invoked is whether the model would usefully reach for the skill on its own. Lifecycle steps a person starts, such as setup, planning or coordinating, are user-invoked. Skills that other skills call, such as the `principle-*` leaves, are model-invoked.

## agents/openai.yaml

Every skill carries one beside its `SKILL.md`, for Codex's skill picker:

```yaml
interface:
  display_name: "Grilling"
  short_description: "Interview the user until a plan is settled"
policy:
  allow_implicit_invocation: false
```

The `policy` block appears only on user-invoked skills.

## Calling another skill

A step that needs another skill says so as an instruction to load it by name: `Load the "principle-prove-it-red" skill.` One skill per instruction. Never link into another skill's folder, and never leave a bare `/name` in a step for the model to interpret. Material that several skills need lives in the skill that owns it.

Only model-invoked skills can be loaded this way. Nothing but a person can run a user-invoked skill, so when a step needs one, it tells the user to run it: "tell the user to run `/tangela-setup`".

READMEs and the `tangela` router name skills for a person to choose from. They aren't loading anything, so they use `/name` as a plain label.
