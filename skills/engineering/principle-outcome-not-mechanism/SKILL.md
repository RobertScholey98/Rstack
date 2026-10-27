---
name: principle-outcome-not-mechanism
description: A brief names the outcome and the proof that counts, defines its words, and allows "no change, with evidence". Use when writing or refreshing a brief for another agent, or when a brief's suggested method doesn't fit the code.
---

# Outcome, not mechanism

A brief says what must be true when the work is done and what proof counts. It defines every word that could be read two ways. It accepts "no change, with evidence" as a complete answer.

## Why

The person writing a brief knows the code less well than the worker will an hour into the unit. A method named in the brief is a guess made from further away. A worker follows it into the wrong shape, or spends its time working around it.

The same failures recur:

- **A literal value.** A brief that names the exact entries to allow breaks something nobody listed. "No violations, and list each entry you add" lets the worker find the missing one.
- **A word that names an event.** "Reset it when the view closes" gets a test that closes the view. When the path users take never closes it, the test proves nothing. A word defined by what a test can observe doesn't have this gap.
- **A thing that doesn't exist.** A brief names a shared helper that is dead code, or components that were never written. The worker guesses what was meant.
- **A false premise.** A ruling assumed the fix was on one side of a boundary, and the other side forbids it. Only "no change, with evidence" is honest there.
- **A syntax.** "Use this operator" when a plain annotation fits. Name the result ("a missing case is a type error") and let the worker pick the syntax.

## Apply it

For each requirement in a brief:

1. Ask whether a stranger could tell from the code and a test run that it's met. If not, give it a number or a test.
2. When it names a tool, a syntax or a file shape, rewrite it as what must be observable. Keep the method only as a suggestion the worker may drop.
3. When a word could mean two things, define it by what you can observe.
4. When it assumes something about the code, check it before the brief goes out, and write down what you checked.
5. When the outcome may already hold, say so.

## Check it

No script judges a brief's wording. `/tangela-plan` won't issue a brief with an empty field, and a worker's report can come back "no change, with evidence".
