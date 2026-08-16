# RLS failures are silent

**Summary:** a query outside the tenant seam does not error under row-level security — it
returns an empty result set. Blank screens and "no rows" with no exception are the symptom.

**Observed:** legacy repo, repeatedly; the boundary review still found unscoped updates late.
Re-confirmed as the reason the seam is a type and a lint rule, not a convention (ADR-0004).

**How it presents:** empty lists, a blank page, a "not found" for a row you can see in psql as
owner. No error anywhere.

**Fix:** the code path is outside `forTenant`/`runAsSystem`, or the GUC is not set on that
connection. `pnpm test:db` is the diagnosis tool: it proves the scoped read and the refused
cross-tenant write on the live database.
