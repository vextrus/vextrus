# ADR-0003 — tRPC for the API; zero codegen anywhere in the repo

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

The legacy API was GraphQL with a checked-in generated SDL, a gitignored generated types layer
that went stale on every merge, and a hand-written hooks mirror — measured as a primary
contributor to ticket size and to the "green build, stale artifact" trap class. Untyped or
generated API boundaries are where agent errors survive to production.

## Decision

Internal API is **tRPC**: per-module routers composed into one `appRouter`, Zod on every input,
TanStack Query on the client via tRPC's integration. **No generated directories exist in the
repo.** No GraphQL. A public REST/OpenAPI surface is added only when a named customer needs one,
as a thin layer over the same module functions. The tRPC root lands with the first module ticket
that exposes a procedure; the skeleton carries the decision, not an empty router.

## Consequences

- End-to-end types with zero build steps; the stale-codegen trap class has no equivalent here.
- Non-TS clients have no API today. Accepted: none exist.
- Procedures stay thin — authenticate, mint the tenant context (ADR-0004), call a module
  function. Domain logic lives in modules, so a future public API reuses everything.
