---
name: tangela-plan
description: Cut a tangela program's rulings into units and briefs, order the units by file overlap, choose solo or coordinated mode, and write the orders.
disable-model-invocation: true
---

# tangela-plan

Turn the program's rulings into **units**, each one a worker can finish and land on its own, with one **brief** per unit and the **orders** every worker follows. Run it after `/tangela-decide`, and again whenever new rulings arrive while the program runs.

Work in the checkout of the program's integration branch. Find the store with `node .tangela/scripts/program.mjs`. On `PROGRAM NONE`, stop and tell the user to run `/tangela-investigate`.

## 1. Gather

Read `decisions.tsv` (rows of kind `ruling` and `default`), each investigation's `findings.json`, `ratchets.tsv`, `units.tsv` and `attention.md`.

A ruling is in a unit already when a search of `briefs/*.md` finds its `ref`, because every brief's Rulings table lists its refs. Done when every ruling's `ref` is either in a brief or on your list to place.

## 2. Cut units

Start a read-only explorer sub-agent on opus at low effort for each group of related rulings. Ask it for two things, in a short answer:

- the files and symbols each ruling would change;
- whether each ruling's **premise** holds in the code: the piece it names exists, and behaves the way the ruling assumes.

A false premise goes back to the user before any brief carries it: add an `attention.md` item, or tell the user to run `/tangela-decide` on it.

Then cut:

- Rulings that change the same files go in one unit.
- A helper that another unit will call lands in an earlier unit, so the later unit only calls it.
- A unit is small enough that one worker finishes it inside its budget, and large enough to land on its own.

Write each unit's row, with `id` in lowercase kebab case:

```bash
node .tangela/scripts/program.mjs unit <id> state=planned "title=<title>" "depends=<unit> <unit>"
```

It prints `UNIT <id> planned`. Log each deferred ruling with `program.mjs log note <ref> "deferred: <why>"`.

Now that units have ids, place the pending marks `tangela-encode` held back. Find its `note` rows whose decision is "encoded as pending marks, waiting for a unit". For each, load the "tangela-encode" skill with that ruling and the id of the unit that carries it.

Done when every ruling sits in exactly one unit or is deferred with a logged reason, every unit has its file list, and every held-back mark is written with its unit's id.

## 3. Order by file overlap

List the files each pair of units both touch. For every overlapping pair, choose one:

- **Merge** them into one unit.
- **Sequence** them with a `depends` edge. A unit that moves or renames files lands before any unit that edits those files. Small fixes to files a large restructure will move land before the restructure, so it starts from a settled base.
- **Fence** them, when they must run at the same time: one unit owns each shared file, and the other's brief lists that file under Fence with the only change it may make.

Record each edge with `program.mjs unit <id> "depends=<unit> <unit>"`. Done when every overlapping pair is merged, sequenced or fenced, and the `depends` column says so.

## 4. Choose the mode

Read the budget from the orders' Budget section. When it still holds the template's placeholder, ask the user for the amount and its unit (tokens, hours or sessions) with the harness's question tool, and write it there.

Estimate each unit's spend in the unit the budget uses. **Solo** when one session can work and land every unit before the orders' stop line. **Coordinated** otherwise. In solo mode the same session works and lands each unit in turn, with no workers.

Write the mode in the orders' Program-specific section, bump the orders version, and log it with `program.mjs log orders <program> "Mode: solo" --why "<the estimate>"` (or "Mode: coordinated").

Done when the orders hold the budget, and the orders and that row both name the mode.

## 5. Write the orders

Fill the store's `orders.md` section by section, as [ORDERS.md](ORDERS.md) says. Each rule appears once. Any edit bumps the version on its first line and logs `program.mjs log orders <program> "Version <n>: <what changed>"`.

Done when every section is filled or holds its template defaults, and no line restates the contract, the repo's agent rules or `tangela-work`.

## 6. Write the briefs

Load the "principle-outcome-not-mechanism" skill. Then write `briefs/<unit>.md` for each unit from [BRIEF.md](BRIEF.md), in `depends` order.

A field you can't fill is a unit you haven't scoped. Leave that unit `planned` and say what's missing. Issue only complete briefs, with `program.mjs unit <id> state=briefed`.

Done when every `briefed` unit has a brief with every field filled, stamped with the current orders version and the last `decisions.tsv` row it was written against.

## Planning again

New rulings after the briefs are written change briefs that haven't launched yet. Rerun steps 1 to 3 for the new rulings, then refresh each `briefed` unit they touch: read its brief against the new rows and the current orders, rewrite what changed, and restamp it. `/tangela-coordinate` refuses to launch a brief whose stamp is older than the orders or the rulings it carries.

## Reply

Tell the user:

- the units in launch order, each with its `depends` and its fences;
- the mode, and the spend estimate that chose it;
- the orders version, and the store path of the orders and the briefs;
- rulings deferred and units left `planned`, each with what's missing;
- attention items you raised, each with the word that settles it.

Then tell the user to run `/tangela-coordinate`.
