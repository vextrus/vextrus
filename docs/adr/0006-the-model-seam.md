# ADR-0006 — The model seam: AI proposes, code resolves, a human disposes

**Date:** 2026-08-16 · **Status:** accepted (second founding; new)

## Context

This is an AI-native product with, until now, no decision about where model calls live. The
first founding had one sentence of prose — *"AI proposes; it never concludes"* — in a map note.
Prose is how the legacy repo enforced tenancy, and it is why tenancy is now a typed seam
(ADR-0004). The domain law already fixes what a model may and may not do: no billable number is
ever computed by a model (`formulas.md`: *no AI anywhere in the fan-out*); a schedule read or a
note reading takes effect only on a per-sheet human act (`identity.md` §6); the scope
register's absence causes have originator legality a model can never satisfy
(`quantity-contract.md` §2); and every claim about a drawing must cite a **source key** that is
self-authenticating (`cad-ingestion.md` §2 — *a model hallucinating a plausible integer passes a
counter-based verifier; a content digest it cannot*). What was missing is the code shape that
makes those laws unbreakable at the call site.

## Decision

**One typed function, `callModel` in `src/core/model.ts`, is the only path to a model.** ESLint
bans the SDK import everywhere else; the fixture test proves the rule fires. It:

1. **Pins the model by id.** `model: ModelId`, a closed const (`MODEL_IDS`). Adding a model is a
   diff to that const and to the ledger's CHECK, never a string at a call site.
2. **Attributes cost to a tenant.** Takes a `TenantCtx`; token usage lands on the tenant's row.
3. **Records every call in the model call ledger** (`model_calls`, tenant-scoped, append-only by
   grant), proposed or refused, with the request's content hash, transport kind and outcome. The
   ledger is **not** the act log: a model call is machine work and `identity.md` §7 keeps the act
   log human-only. A human act that relies on a proposal cites the call id as evidence. *(This is
   the reading taken of the brief's "records the call against the act log"; the alternative — a
   model call as an act — would contradict carried domain law.)*
4. **Replays deterministically from fixtures inside `pnpm verify`.** A `ModelTransport` is either
   `fixture` (replays `<dir>/<requestHash>.json`; a missing fixture is the named refusal
   `FIXTURE_MISSING`, never a network call) or `live` (the SDK, landing with the first model
   ticket, which also records fixtures). Verify has no network and no key.
5. **Returns a `Proposal<T>` or a `Refusal` — never a conclusion, never a quantity.** A proposal
   is `{ payload, sources: [SourceKey, ...SourceKey[]], model, callId }`. The `sources` type is a
   non-empty tuple, so an unsourced proposal does not typecheck; `proposalSchema` refuses it at
   runtime (`UNSOURCED`); a key outside the closed scheme vocabulary is not a source; and **code
   resolves every cited key against the artifact before the proposal is returned** — one
   unresolvable key refuses the whole proposal (`SOURCE_UNRESOLVED`). Non-JSON or off-schema
   replies are `MALFORMED`. All refusals are recorded with usage.
6. **Abstention is not the model's decision.** The seam offers no "I don't know" payload; a
   proposal either cites and resolves or it is refused with a named cause, and what happens next
   (a queue item, a declared exclusion) is decided by the caller under `quantity-contract.md` §4,
   never by the model's phrasing.

What a proposal may then become: an **offer** to the gate (`measurement-rules.md` §8, still a
pure function returning offers, never lines), a candidate **reading** presented for human
disposition, a **classification** proposal (view class, discipline) that stays proposed until a
human confirms. Nothing in `db/schema` accepts a `Proposal`; the register's writers take offers
and acts.

## Consequences

- "AI proposes; it never concludes" is now a return type and a lint rule, not a sentence.
- Every model call is reproducible from the repo: same request hash, same fixture, same
  proposal — a rebuild of derived state never re-asks a model.
- The price is a fixture-recording discipline for every model-using ticket, paid deliberately.
- Cross-model or cross-prompt drift is visible: the request hash changes, the fixture misses, and
  verify says so by name instead of silently calling a different model.
