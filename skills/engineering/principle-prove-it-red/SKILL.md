---
name: principle-prove-it-red
description: A new test counts only if it fails on the old code, the way the bug really happens. Use when adding a test for a fix, or claiming a test proves a change.
---

# Prove it red

A new test of new or changed behaviour counts only if it goes **red** on the old code, the way the bug really happens. A pin is exempt: it passes on the old code by design.

## Why

A test that passes on the old code proves nothing about the fix. A test can call the right code yet drive it in a way the bug never happens, and pass with or without the fix. Only a test that fails on the old code shows it reproduces the bug. Running it there also finds bugs the fix didn't aim at, when it fails for a second reason. Swapping old files in by hand is slow enough to get skipped and reasoned about instead, so a script does it.

## Steps

1. Commit the fix and its test.
2. Run the test against the old code:

   ```bash
   node .tangela/scripts/prove-red.mjs --run "<the command for this one test>" <each source file the fix changed> --base <the commit before the fix>
   ```

   Name the source files, never the test file: the test must run as written against the old code.
3. Read the verdict.

| Last line | Exit | Do |
| --- | --- | --- |
| `RED PROVEN` | 0 | Keep the failing line for your report's **Proved red** entry. |
| `NOT RED` | 1 | The test misses the bug. Rewrite it to drive the bug the way a user meets it, and run again. |
| anything else | 2 | Read the message. It refuses files with uncommitted changes, so commit first. |

Done when every new test of new or changed behaviour has `RED PROVEN` and its failing line.

## Check it

`prove-red.mjs` always restores the files it swapped. The report's **Proved red** line quotes each failing line.
