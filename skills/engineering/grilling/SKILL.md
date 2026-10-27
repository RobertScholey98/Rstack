---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Work the frontier **one question at a time**, through the harness's built-in tool for asking the user a question, so each question arrives as a choice to pick rather than a wall of text to read.

For each question:

- Give it a short header, and word the question so it stands on its own.
- Offer two to four answers. Put your recommended answer first and mark it "(Recommended)". Give each answer a one-line description of what choosing it means.
- The user can always answer in their own words instead. Treat that as their answer and don't ask again.

Wait for the answer before asking the next question.

Each answer reshapes the tree: a settled decision pushes the frontier outward and unblocks the questions that depended on it. When an answer opens a new branch, ask its follow-up next, while the context is fresh. Recompute the frontier after every answer, and never ask a question whose answer depends on one still open.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Summarise what was decided, then ask one last question: is this our shared understanding? Do not act on it until the user says yes.
