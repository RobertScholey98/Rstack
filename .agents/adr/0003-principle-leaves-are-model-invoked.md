# Principle leaves are model-invoked

tangela's skills lean on short principle leaves, one idea each, such as "a new test counts only if it fails on the old code". pstack keeps its leaves user-invoked and has skills read them by file path, which keeps them out of the session's skill list.

Ours are model-invoked. Each has a short model-facing description, and skills load them by name.

## Why

A plugin's files sit at a different path on every machine and in every harness, so reading a leaf by path breaks. Loading by name works in any install.

## Consequences

Each leaf costs one line in every session's skill list. A leaf that only one skill uses goes in that skill's own folder instead.
