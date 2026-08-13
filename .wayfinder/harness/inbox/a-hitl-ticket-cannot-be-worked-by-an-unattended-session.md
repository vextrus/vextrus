# A HITL ticket cannot be worked by an unattended session, and nothing on the dispatch path says so

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

## Objective

Three rules in this tree are each correct alone and jointly unsatisfiable:

- `.claude/skills/wayfinder/SKILL.md` §49: *"A HITL ticket only resolves through that live
  exchange; the agent never stands in for the human's side (a grilling agent that answers its
  own questions has broken this)."* §53 makes `grilling` **the default type**.
- `CLAUDE.md` §5: *"**Nobody is watching while you work**, and you cannot ask mid-session […]
  take the most defensible one, name the assumption […] and finish."*
- `AskUserQuestion` is denied (`.claude/settings.json:70`), and ADR-0013 established that `deny`
  **prunes the schema** rather than refusing the call — the tool is not visible to the session,
  so there is nothing to disobey. ADR-0011 ruled this deliberately and named the previous
  "check in" wording as the defect it was fixing.

So a `wayfinder:grilling` ticket dispatched to a cloud session is **unresolvable by
construction**: it resolves only through an exchange the session has no mechanism to open. The
session's compliant move is §5's fallback — most defensible reading, name the assumption, finish
— which is exactly the thing §49 calls broken. Both parties are obeying; the instruction pair is
the fault.

Measured cost, 2026-08-13/14 — twice, by two different paths:

- Ticket 10 (`wayfinder:prototype`, HITL) executed by the first conducted worker (#35), reverted
  by #36, re-reverted by #46.
- Ticket 13 (`wayfinder:grilling`) executed by a hand-dispatched cloud session (#41 → #44),
  which landed 299 lines of ruling **and amendments to `measurement-rules` §8 and
  `quantity-contract` §2/§4** — domain law, amended by a flow that had no standing to amend it.
  #46 reverted the effort *"byte-for-byte to 25e7dc5"* but changed one line on ticket 13 (the
  claim), leaving the ruling and both domain-doc amendments on `main` for a day. Finished by
  #52. The session disclosed the caveat in its own PR — *"this is a wayfinder:grilling ticket —
  nominally HITL — and I worked it AFK, since nobody was in session"* — and no mechanism read
  the disclosure.

`the-frontier-cannot-see-what-kind-of-ticket-it-picks.md` (open, same inbox) names this class for
the **loop**, and proposes gates in `frontier.mjs` / `conduct.mjs`. **Those gates would not have
caught ticket 13.** #41 and #49–#51 are `pnpm dispatch` claims — a human claiming on `main`, no
frontier, no conduct. Audited 2026-08-14: the `wayfinder:<type>` line appears in `scripts/`
**only inside test fixtures** (`frontier.spec.mjs:36`, `promote.spec.mjs:12`,
`dispatch.spec.mjs:17`) and is read by no production code. `dispatch.mjs` carries `FIELD` regexes
for `status` and `claimed` and refuses a file lacking either — it has no regex for the type line
at all. That ticket and this one are the same law with two enforcement points; neither subsumes
the other.

## The decision

1. **Does the type line gate `pnpm dispatch`, fail-closed?** A HITL type (`grilling`,
   `prototype`, and `task` when marked HITL) claimed for an unattended session is refused, with
   the refusal naming the ticket and its type; an absent or unknown type counts as HITL. The
   shape is already there — `dispatch.mjs` refuses a missing `Status:`; this is one more `FIELD`
   entry.
2. **How does the dispatcher say "I am actually here"?** A gate with no override makes hand-run
   HITL dispatch impossible, which is the normal and correct way to work a grilling ticket. An
   explicit flag (`--attended`?) that the human passes for themselves is the obvious candidate —
   rule whether that is enough, given that the same human is the one who would pass it
   reflexively.
3. **Does `CLAUDE.md` §5 gain the linkage?** §5 already carries the escape hatch — *"Stop only
   when proceeding would be unsafe or the result useless if wrong"* — and a HITL ticket worked
   AFK is squarely inside it, since the whole product is the human's decisions. But nothing
   connects `wayfinder:grilling` to that clause, so a session must infer it against §5's much
   louder "nobody is watching… and finish". If yes: this costs bytes against ADR-0007's
   ≤6,000-byte cap (5,998 used after ADR-0014's trims), so name the trim or re-rule the cap.
4. **Where does the belt-and-braces live — refuse, or disclose?** #44's session *did* disclose
   the violation in its PR body, correctly and unprompted. Rule whether a disclosure of this
   class must fail a check (CI, or the review lane) rather than rely on the merging human
   reading the PR body, given that #46 read it and reverted the wrong line anyway.
5. **Is `grilling` the right default type** for a repo whose default session is a cloud
   container (ADR-0011)? Rule it or record why it stands.

## Guardrails

- Do **not** resolve this by weakening §49. An agent answering its own grilling questions is the
  failure mode the whole HITL distinction exists to name; the fix is that such a ticket never
  reaches an unattended session, not that it is allowed to self-answer once it does.
- Do **not** resolve it by re-enabling `AskUserQuestion`. ADR-0011 denied it on measurement — a
  prompt in an unattended container is wall-clock burning until someone looks — and that finding
  is untouched by this ticket.
- Coordinate with `the-frontier-cannot-see-what-kind-of-ticket-it-picks.md`: if both land, the
  type-line predicate should be **one** shared helper, not two drifting copies. That ticket's
  decision 3 (nothing points `conduct.mjs` at `.wayfinder/takeoff/tickets` until ruled) stands
  regardless of this one.

## Acceptance

- [x] Ruled: whether `dispatch.mjs` refuses HITL types, fail-closed on absent/unknown, and by
      what mechanism the dispatcher asserts attendance.
- [ ] Whatever refuses does so by naming the ticket and its type, and is covered by a test in
      the scripts lane. — build work, ticketed as `the-attended-claim-and-its-gate.md`
- [ ] The type-line predicate has exactly one implementation, shared with the frontier gate.
      — same ticket
- [x] `CLAUDE.md` §5 either states the HITL linkage or a reason is recorded for leaving it to
      the dispatch gate alone; if it states it, ADR-0007's cap is honoured or re-ruled with a
      number. — reason recorded (ADR-0015 §6); the cap is untouched at 5,998/6,000
- [x] `.claude/skills/wayfinder/SKILL.md` states what happens when a HITL ticket reaches an
      unattended session — currently it defines the category and not its enforcement.

## Resolution

Ruled by **ADR-0015**, in an attended `/grilling` session on 2026-08-14 — six questions, one at
a time, on the ticket describing the failure. Landed: the ADR, the `SKILL.md` amendments, the
`TRACKER.md` claim rule. Deferred by design: the mechanism.

**The premise in the Objective was half wrong, and the ruling inverts it.** This ticket asked
whether `dispatch.mjs` should refuse to dispatch a HITL ticket, fail-closed. It should not. An
unattended session may work a HITL ticket **for facts** — `/grilling` already assigns the agent
that half (*"if a fact can be found by exploring the environment, look it up rather than asking
me"*), and it is the expensive half. What was missing was never permission to start; it was a
place to stop.

The six rulings, in the order they were forced:

1. **Facts yes, decisions no.** The session researches, writes findings into the ticket,
   sharpens the questions, and stops at the first decision.
2. **The boundary is two forbidden writes, not a new state.** No `## Resolution`, no
   `Status: closed`. `Status:` stays binary — a HITL ticket with the reading done is *open*,
   which is what open has always meant. The third state proposed in the grilling was withdrawn
   once it was clear `open` already denotes it.
3. **A session clears its own claim when it stops, not only when it closes** — otherwise a
   session halting at the boundary leaves a claim the frontier can never see past.
4. **The claim on `main` carries attendance**: `attended <date>` via `pnpm dispatch --attended`.
   A session cannot push to `main` and never merges its own PR (ADR-0010), so it cannot
   manufacture the value. The commit trailer is what CI reads; the claim is what makes the
   trailer mean anything.
5. **CI enforces, fail-closed**, not `pre-push` — that hook runs inside the container it would
   constrain.
6. **The rule lives in the skill, not `CLAUDE.md`** (5,998/6,000 bytes; ADR-0014 declined to
   move the cap). `SKILL.md` already stated the law and lacked only the sentence after it.
   `grilling` stays the default type.

**The measurement that forced it.** Two, both already in the tree. Ticket 15's finding, recorded
at `scripts/checkup.mjs:594` — *"`gpg.ssh.program` is an opaque binary that ignores
`user.signingkey` […] and signs anyway"* — kills signing as proof of attendance: a container
signs indistinguishably, so no commit-time artifact is unforgeable on its own, and the
unforgeable act had to be found elsewhere (the merge click, decision 4). And #44 itself: the
session disclosed its own violation, correctly and unprompted, and the next human read that PR
and reverted the wrong line anyway. That is what rules out every honour-based remedy, including
the one this ticket's own decision 4 floated.

**Put and rejected:** refusing HITL tickets at dispatch (throws away the AFK half `/grilling`
explicitly assigns the agent); a third `Status:` value (the constraint "no new status field" was
imposed during the grilling and proved to cost nothing — `open` was already the state); keying
the gate on the claim value alone, fail-open (#41 wrote `Claimed by: claude/the-rail-gate`, a
format `dispatch.mjs` no longer produces — a gate keyed to `dispatched` would have waved #44
through); the `Claude-Session:` trailer as a container detector (runner-supplied, which ADR-0014
forbids relying on); a separate `pnpm attend` verb (better name, second copy of the same body);
and spending `CLAUDE.md` bytes on a rule the skill already carries.

**What this does not do.** The mechanism is not built — wayfinder plans, it does not do. Until
`the-attended-claim-and-its-gate.md` lands, decision 5 is prose and the boundary rests on 1–3
being read. Said plainly because the ticket's own subject is a rule that read as enforced and
was not.

**One thing this ruling cannot bind: the session that made it.** This ticket is an unnumbered
inbox file with no claim, so there was no attended claim on `main` to match and nothing for the
future gate to check. It closes under the rule that existed when it opened. Recorded rather than
tidied — an amendment that reads as retroactively satisfied is the fault #46 committed on ticket
13.
