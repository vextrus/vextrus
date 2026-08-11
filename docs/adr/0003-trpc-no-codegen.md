# ADR-0003 — tRPC for the API; zero codegen anywhere in the repo

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy API was GraphQL: a 46,676-line generated SDL (checked in, hand-edited, and rewritten
by any running dev server), a gitignored 101K-LOC generated types layer that went stale on
every merge, and a 21K-LOC hand-written hooks mirror. The chain added four artifacts and three
stale-lie modes between a domain change and a green build, and was measured as a primary
contributor to the ticket-size floor. Field reports name codegen drift the top GraphQL DX
complaint and typed-RPC inference the fix for internal TS clients.

## Decision

Internal API is tRPC: per-module routers composed into one appRouter, Zod on every input,
TanStack Query on the client via tRPC's integration. No generated directories exist. No
GraphQL. A public REST/OpenAPI surface is added only when a named customer needs one, as a thin
layer over the same module functions.

## Consequences

- End-to-end types with zero build steps: the entire stale-codegen trap class from
  `docs/TRAPS.md` (legacy) has no equivalent here.
- Non-TS clients have no API today. Accepted: none exist, and the named-customer test governs
  adding one.
- tRPC procedures stay thin — they authenticate, mint the tenant context, and call module
  functions; domain logic lives in modules, so a future public API reuses everything.
