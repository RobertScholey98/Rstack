# Changesets

Add one with `npx changeset` for any change a plugin user would notice, and pick `patch`, `minor` or `major`. On `main`, the release workflow gathers pending changesets into a "chore: version skills" PR. Merging it bumps the version in `package.json` and `plugin.json` and writes `CHANGELOG.md`.

See the [changesets docs](https://github.com/changesets/changesets) for the rest.
