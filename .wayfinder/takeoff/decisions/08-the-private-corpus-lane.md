# The private corpus lane

[Ticket](../tickets/08-the-private-corpus-lane.md) · built 2026-08-13 · operator doc [`docs/private-corpus-lane.md`](../../../docs/private-corpus-lane.md)

**Built, and the BOQ is sealed.** `pnpm corpus` runs the pipeline over `VEXTRUS_PRIVATE_CORPUS`
and reports counts, counters, refusals and stage failures; it refuses mechanically if the path
resolves inside (or contains) the repo, writes nothing into the tree, and gates nothing — proven
by reading `verify.mjs`/`ci.yml`. The Edison BOQ workbook is **not read as ground truth at all**
until bar 2's clean-room yardstick exists, and then only as corroboration: §5's back-solving ban
is unenforceable once the number has been seen. Rejected: reading it now for defect discovery.
