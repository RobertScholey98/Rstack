# Copy the generic skills tangela needs, and own them

tangela leans on a handful of generic skills: grilling, domain modelling, codebase design, test-driven development, code review and retrospectives. Matt Pocock publishes good versions of all of them under MIT.

We copy them into `skills/engineering/` once, list them in `NOTICE`, and from then on treat them as ours. We don't depend on his plugin, and we don't sync from upstream.

## Considered

- **Depend on his plugin.** No copies to maintain. But Rstack would only work with a second plugin installed, his setup skill would compete with `tangela-setup`, and his skills could change under tangela without notice.
- **Vendor with a pinned sync.** Copies refreshed from a pinned upstream commit, with hand edits blocked. That stays close to upstream, but every change we want would fight the sync.

## Consequences

- Rstack installs as one plugin with no prerequisites.
- The copies drift from upstream on purpose. Pull an upstream improvement across by hand when it's worth it.
- A copy's setup pointers go to `tangela-setup` and the repo contract instead of his setup skill.
- Someone with both plugins has two skills with the same name. Plugin namespacing keeps them apart (`rstack:grilling` and `mattpocock-skills:grilling`), but a flat skills directory doesn't, so don't link both into one.
