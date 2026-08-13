# The attended claim and its gate

wayfinder:task
Status: open
Blocked by:
Claimed by:

## Objective

ADR-0015 ruled the HITL boundary and left it unbuilt: decisions 1–3 are prose in `SKILL.md` and
`TRACKER.md` that a session must read and honour, and decisions 4–5 — the part that does not
depend on honour — have no implementation at all. Until this lands, a rule that reads as
enforced is not, which is the exact fault the ADR was written about.

Build what ADR-0015 ruled, and nothing it did not.

## The work

1. **`pnpm dispatch --attended`.** `dispatch.mjs:118` hardcodes
   `const claim = \`dispatched ${date}\``; the flag makes it `attended ${date}`. Everything else
   — the claim PR, the refusals, the residue handling — is unchanged. Amend the file header,
   which currently describes the tool as dispatching to a container only; an attended claim
   asserts the opposite and the header should say why it lives here anyway (ADR-0015 rejected a
   separate `pnpm attend` verb).
2. **The type-line predicate**, in one place, shared. `dispatch.mjs` and
   `scripts/loop/frontier.mjs` both parse tickets and neither reads `wayfinder:<type>` today —
   audited 2026-08-14, the string appears in `scripts/` only inside test fixtures. HITL is
   `grilling` / `prototype` / `task` marked HITL; absent or unrecognised counts as HITL,
   fail-closed. **One implementation** — the ADR's cost of two drifting copies is the reason
   this is called out.
3. **The CI gate.** For each ticket file a PR touches: if the diff adds `## Resolution` or sets
   `Status: closed`, and the type is HITL, then the **base** version's `Claimed by:` on `main`
   must read `attended <date>`. Otherwise refuse, naming the ticket and its type. CI, not
   `pre-push` — the hook runs inside the container it would constrain.
4. **The commit trailer.** ADR-0015 decision 4 makes the trailer the surface CI reads and the
   claim what gives it meaning. Its name and exact form were **not ruled** — see below.
5. **Tests in the scripts lane**, covering: the flag writes `attended`; unknown type refuses;
   a file with no `Status:` (the three evidence artifacts in `harness/tickets/`) is not a ticket
   and cannot trip the gate; a HITL close with a `dispatched` base claim refuses; with an
   `attended` base claim passes.

## Open — resolve before or during, do not silently pick

- **The trailer's name and form.** ADR-0015 ruled *that* there is a commit-time positive act and
  that CI reads it; it did not name it. If the claim on `main` is already sufficient for the
  gate, say so and drop the trailer rather than shipping a field nothing reads — but that is a
  narrowing of decision 4 and belongs in the resolution, not in a commit message.
- **The frontier's own behaviour.** `the-frontier-cannot-see-what-kind-of-ticket-it-picks.md`
  (open, same inbox) asks whether `frontier.mjs`/`conduct.mjs` should refuse non-`task` types
  outright. ADR-0015 changes its premise — an unattended session may now *work* a HITL ticket,
  so a blanket refusal is no longer obviously right. **These two must be read together**; the
  shared predicate in item 2 is the seam between them. That ticket's decision 3 — nothing points
  `conduct.mjs` at `.wayfinder/takeoff/tickets` until ruled — stands regardless.

## Guardrails

- Do not re-litigate ADR-0015. Its rejected list is closed: signing (a container signs
  indistinguishably, `scripts/checkup.mjs:594`), the `Claude-Session:` trailer (runner-supplied,
  ADR-0014), disclosure-as-remedy (#44 disclosed and it did not help), a third `Status:` value.
- Do not spend `CLAUDE.md` bytes. 5,998/6,000, and ADR-0014 declined to move the cap.
- The gate refuses; it never repairs, and every refusal names its repair — `dispatch.mjs` and
  `promote.mjs` both already work this way.

## Acceptance

- [ ] `pnpm dispatch --attended` writes `attended <date>` through the same claim-PR flow.
- [ ] One type-line predicate, shared by every caller, fail-closed on absent/unknown.
- [ ] CI refuses a HITL close whose base claim on `main` is not `attended`, naming ticket and
      type; the refusal is reachable in a test, not only in review.
- [ ] The trailer is either specified and read, or dropped with the narrowing recorded.
- [ ] `SKILL.md`'s ADR-0015 reference stops being a forward promise — the sentence
      "enforced in CI" is true when this closes.
