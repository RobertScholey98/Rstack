# Orders, version 1

The standing orders for every agent in this program. Each rule appears once. Any edit bumps the version on the first line and adds a row of kind `orders` to `decisions.tsv`.

## Never

- Never push.
- Never open a pull request.
- Never edit the default branch's checkout.
- Never skip the commit hook.

## Always

- Always work in your unit's worktree, on your unit's branch.
- Always re-read these orders before each step, and name the version you followed in your report.

## Models

| Role | Model | Effort |
| --- | --- | --- |
| worker | opus | medium |
| explorer | opus | low |
| reviewer | opus | medium |
| second reviewer | sonnet | medium |

The second reviewer runs only when the Review section calls for one.

## Concurrency

- CPU: 75%. Launch another worker only while machine load stays under this, as `doctor.mjs` measures it.
- Memory: 85%. Launch another worker only while memory in use stays under this.
- Ceiling: 4. No more than this many workers run at once, whatever the load.
- The e2e lock is always on. Every step that drives a browser or a shared server takes it.

## Review

- Size the review to the diff. One review reads every landing. A review is one pass of what `tangela-land` starts, so code-review's two axes are one review.
- Add a second reviewer, on a different model, above 400 changed lines or when the diff touches a widened path.
- Apply a review suggestion that changes behaviour only after a test pins the new behaviour.

## Verification

- Workers run the `unit` tier, which widens itself when the diff touches a shared path.
- Only landing runs the `merge` tier.

## Budget

- Budget: <amount> <unit>
- Each unit's spend in `units.tsv` uses the same unit.
- Stop launching at: 70%

## Program-specific

