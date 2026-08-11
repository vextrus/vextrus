# Views, grid, and first identities

wayfinder:task
Status: open
Blocked by: 04-upload-and-ingest-job.md

## Objective

From a stored artifact: view partition (closed vocabulary, one may-yield-instances predicate),
grid backbone (content-signature bubbles, layout-plan evidence only), and the first
`register_objects` — columns/walls placed at grid intersections with the full identity key,
ordinals frozen. Then the moat test: ingest the revision-pair fixture and prove identities
survive — moved/added/removed members report as a delta, dispositions carry forward per the
semantic law.

## Guardrails

- `docs/domain/cad-ingestion.md` §7–§9 and `docs/domain/identity.md` §2–§5 bind verbatim —
  the CI check that exactly one may-yield-instances decision site exists lands here.
- An unclassifiable caption anchors nothing; a view without lawful bubble evidence defers with
  a named reason. No guessing, anywhere.
- No quantities yet — objects and identity only.

## Exit criteria

- [ ] The revision-pair test: identical multiset of identity keys for unchanged members;
      changed members re-present; nothing orphans. This is the map's destination test.
- [ ] Refusals/deferrals all carry named reasons, asserted in tests.
- [ ] `pnpm verify` green and under 60s.
