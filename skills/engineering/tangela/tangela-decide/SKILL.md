---
name: tangela-decide
description: Grill a tangela program's findings into rulings, one question at a time, and write the rulings into ADRs, conventions and the glossary.
disable-model-invocation: true
---

# tangela-decide

Turn findings into **rulings**: what the program will do about each one, settled once by a person and written where every later agent reads it. The person's answers are the only input you can't produce yourself, so spend their attention on decisions and find every fact yourself.

## 1. Gather

Work in the checkout of the program's integration branch. Run `node .tangela/scripts/program.mjs` there for the store. Read every `findings.json` and `baseline.md` under `<store>/investigations/`, the repo's ADRs, conventions and glossary, `attention.md`, and the `ruling` rows already in `decisions.tsv`. A finding with a ruling is settled; leave it unless the user reopens it.

Done when you hold a list of every unruled finding ID.

## 2. Batch and order

Group findings that one answer settles: the same root cause in several areas, or a structural choice that decides how several findings are fixed. A batch is one question. Order the questions so a structural ruling comes before the findings that build on it: decide where shared grid cells live before deciding each grid's column fixes.

Within that order, ask high severity first. Done when every unruled finding sits in exactly one batch.

## 3. Grill

Load the "grilling" skill and work the batches through it: one question at a time with the harness's question tool, your recommendation first.

- Each question names its finding IDs, states the cost in one line from the finding's `why`, and offers the finding's `question` as the choice.
- The usual verdicts are **include** (fix it in this program), **part** (fix the part you name), **later** (recorded for a future program) and **skip** (won't fix, with the reason). A structural question offers the real options instead.
- A fact the answer depends on (does it reproduce, how many sites, what the library does) is yours to establish first, with a sub-agent if it is wide. Ask the person only what no experiment settles.
- When the person answers in their own words, or proposes a different shape, that is the ruling. Read it back in one line before moving on.

Every ruling carries a **default**: what a worker does when it meets a case the ruling didn't foresee and nobody can be asked. Write it with the ruling. Take it from the person's answer when they gave one; otherwise propose it in the read-back.

A question only a later unit can answer, such as one that waits on another team or on work not yet done, goes to `attention.md` in its fixed format, with its default.

Done when every batch has a ruling or an attention item.

## 4. Log each ruling once

For each finding, log one row:

```bash
node .tangela/scripts/program.mjs log ruling <finding ID> "<verdict>: <what will change>. Default: <the default>." --why "<the person's answer>" --evidence investigations/<name>/findings.json --by person
```

It prints `LOGGED ruling <finding ID>`. Findings settled by one batch get one row each with the same decision, naming the others ("with QA-012"). A ruling the person later changes gets a new row; the log is append only.

Done when every finding in `findings.json` has a `ruling` row, or an open attention item.

## 5. Write the rulings into the repo

Load the "domain-modeling" skill. Then:

- **ADRs** only for a ruling that meets domain-modeling's three criteria for one. For a ruling that keeps one way of doing a job, load the "principle-one-way-per-concern" skill.
- **Conventions**: every other ruling on how code is written. The "where does X go" table, a recipe with a Done list for each pattern the rulings make standard, and any house format the person ruled (dates, money, wording). They go where the repo already keeps conventions, or in `docs/conventions.md` when it has no such place.
- **Glossary**: each domain term the grilling settled, one at a time as it settled.

Put each rule in one file, and point to it from the others. Then run `node .tangela/scripts/checks/drift.mjs`. Done when it exits 0 and the repo files are committed on the integration branch through the hook.

## 6. Encode

For each `include` or `part` ruling that a build could check, load the "tangela-encode" skill and encode it. Done when each such ruling is encoded, or has a `note` row saying why no check fits (`program.mjs log note <finding ID> "no check fits: <why>"`).

## Reply

Tell the user: findings ruled by verdict (include, part, later, skip), the attention items raised, the ADRs and convention entries written with their paths, the rulings encoded and how, and any finding left unruled. Then the next step: tell the user to run `/tangela-plan`.
