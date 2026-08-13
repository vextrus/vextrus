# Ruled in charting

*Charting is one session's act, so these seven rulings are one file. Every later decision is one
file per ticket — see `README.md`.*

- **Destination (2026-08-13).** Takeoff terminates in a signed **unpriced** Quantity Bill +
  Certificate of Measured Coverage. The book's two jobs split: the *enumeration* (work items,
  kind, description, unit — the coverage denominator) is **spine-owned**; the *pricing* (zone
  rates, editions, rate analysis) stays in `book/` and out of scope. Rejected: register-terminal
  (leaves differentiator #2 unproven) and pulling `book/` in (conflates two modules).
- **Breadth.** All four algebras land with the depth ladder in `MAP.md`. Rejected
  member-deep-only: the spine owns the gate's shape, so a gate built against one rail encodes
  that rail's assumptions and every later rail retrofits — legacy fault F1/F8.
- **Formats.** DWG, vector PDF **and raster PDF** are all first-class; the **EntityGraph is the
  one interface** and no downstream stage learns a second source format exists. Raster was
  initially deferred and the CEO reversed it: BD clients send scans often, and a module that
  refuses them gets returned.
- **AI's constitution.** Adversarial-first: AI's flagship job is finding *absence and
  contradiction*, output being a refusal reason or a question — structurally incapable of
  inventing a quantity. Recognition/automation is admitted only as verified proposals. Rejected
  automation-first: it is the axis every competitor races on, where accuracy claims are all
  self-reported and unprovable, and it needs a guardrail at every site.
- **Frontend posture.** Disposition-first as primary (the domain law is full of propose/dispose
  pairs already awaiting a surface, and `quantity-contract.md` §7 warns that a canvas
  structurally cannot show the row that is not there) — with **canvas-first as a first-class
  secondary**, built to a standard that stands next to anyone's. Legacy's disposition surface
  *felt mechanical*; the canvas is what prevents that, and it is a stated requirement, not a
  nice-to-have.
- **Scale/architecture.** The JSON artifact stays the immutable, hashable **evidence of record**;
  a **derived, rebuildable Postgres entity index** serves queries and the viewer. The CLI stays
  pure — ADR-0001 untouched.
- **Deployment.** A deployed environment sufficient for bar (c): real URL, real auth, real
  tenancy, invite-only. No billing, no signup funnel, no SLA — those are surfaces for customers
  who do not exist yet (legacy fault F8 in miniature).
