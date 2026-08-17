# ADR-0011 — Permission is enforced in the act seam; participation is a foreign key

**Date:** 2026-08-17 · **Status:** accepted · **Supersedes:** nothing. Resolves decision ticket
#192 on the takeoff map #128.

## Context

This repo's standing instinct is that a rule worth having is a rule the database refuses:
`forTenant(ctx)` / `runAsSystem(reason)` are the only handles, and *RLS refuses what slips past* —
"a bare handle is a breach even when RLS saves you". The act log already carries that instinct into
its own schema: `acts.actor_user_id` is a **composite foreign key to `memberships`** on
`(tenant, actor)`, so an act by a non-member of the tenant is unrepresentable rather than merely
refused (`db/schema/core.ts`, `acts_actor_membership_fk`).

`identity.md` §7 now rules a permission model over the act set: a closed permission enum, a **total
map from act type to permission**, a closed participant role enum bundling permissions, and
project-scoped, append-only participant rows with no implicit grant from tenant membership. That
raises the question this ADR answers, because the two halves of the model do not have the same
enforcement options.

The permission a given act requires is a **code fact** — it is minted with the act type, in the same
pull request, and its totality over the act enum is what makes a missing entry a compile error.
Whether a given actor **participates in a project at all** is a **row fact**, of exactly the shape
the schema already enforces one field to the left.

## Decision

**Participation goes into the schema.** The act log gains a composite foreign key to the participant
table on `(tenant, project, actor)`, beside the existing one to `memberships`. An act by a
non-participant of the project is unrepresentable in Postgres, in the same way and for the same
reason as an act by a non-member of the tenant. `identity.md` §7's *no implicit grant* therefore has
a mechanical floor and does not rest on a check some future caller might route around.

**The permission is checked in the act seam** — at the top of every `commit` in `src/core/acts.ts`,
which `identity.md` §7's amendment makes the sole writer of the act log, with a boundary test making
the log unimportable elsewhere (the mechanism ADR-0010 established for the quantity-line writer).
The check is unbypassable not because a policy refuses it but because there is one door.

**A permission failure refuses `PERMISSION_NOT_HELD`**, one closed reason code carrying act type and
missing permission as data, per `identity.md` §7.

## Alternatives put and rejected

**Row-level policies over the act-type map.** Pushing `ActType -> Permission` into RLS predicates
would give the permission the same refusal-in-Postgres property participation gets. It is rejected
because the map would then exist **twice** — once in TypeScript where its totality is a compile
error, once in SQL where nothing checks that a newly minted act type was added. That is a second
implementation of a domain clause living where the clause's own enforcement cannot reach it, which
is the argument issue #139 used to reject a client-side render resolver, at a different altitude.
The failure mode is concrete and silent: an act type minted with a permission entry and no policy
row is a permission that passes for everybody.

**Everything in application code, including participation.** Simpler by one migration, and rejected
because it discards an enforcement the schema is already shaped to give for free: the composite FK
pattern is present, tested, and costs one more column pair.

**A grant-level same-person bar (signing barred to the measurer).** Ruled against in
`identity.md` §7 on domain grounds, not enforcement grounds: it makes a solo QS unable to reach a
signature, and a solo QS is a real Bangladeshi customer. Concentration is disclosed on the
certificate (`quantity-contract.md` §6) instead.

## Consequences

- **The permission model is application-enforced, and this document is where that is said out loud.**
  A reader who has absorbed *RLS refuses what slips past* must not infer that a permission is
  policy-backed. It is seam-backed. The seam's sole-writer property is therefore load-bearing for
  governance, not only for transactional integrity, and the boundary test that asserts it is a
  security control.
- A bare `forTenant` handle reaching the act log outside the seam would bypass every permission in
  the model. The boundary test is what stops it; the lint rule against importing `db/schema`
  outside the seam is what stops the import that would precede it.
- Participation and permission fail with **different** codes, and only one of them is a database
  error. The seam maps the FK violation to a refusal rather than letting a driver error escape.
