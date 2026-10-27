---
"rstack": minor
---

Add `tangela-setup`, which writes a repo's tangela contract, installs the kit into `.tangela/scripts` and adds a commit hook block that skips itself where the kit is absent. The kit now refuses a tier with no steps.
