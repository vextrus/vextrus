# ADR-0015 — The HITL boundary is mechanical: facts are AFK, decisions are not

Date: 2026-08-14
Status: accepted
Amends: ADR-0010 (claims carry attendance), ADR-0011 (a session cannot ask — the consequence)

> The number 0015 was briefly held by an ADR on the design system, landed by a dispatch session
> that had no standing to land it and removed entirely by the revert in #46. No file bearing
> that number survives on `main`; it is reallocated here rather than skipped, because a gap
> would record a decision the repo does not have.

## Context

Three rules were each correct alone and jointly unsatisfiable.

`.claude/skills/wayfinder/SKILL.md` defines a HITL ticket as one that *"only resolves through
that live exchange; the agent never stands in for the human's side"*, and makes `grilling` — a
HITL type — **the default**. `CLAUDE.md` §5 tells every session *"Nobody is watching while you
work, and you cannot ask mid-session […] take the most defensible one […] and finish."*
`AskUserQuestion` is denied (`.claude/settings.json`), and ADR-0013 established that `deny`
prunes the schema rather than refusing the call — the session does not see a tool and get told
no, it never sees one. ADR-0011 ruled that deliberately, naming the older "check in" wording as
the defect it was fixing.

So a HITL ticket dispatched to a cloud session was **unresolvable by construction**: it resolves
only through an exchange the session has no mechanism to open, and §5 instructs it to finish
anyway. Both halves obeyed; the pair was the fault.

Measured twice, by two different paths:

- Ticket 10 (`wayfinder:prototype`) executed by the first conducted worker (#35), reverted
  (#36), re-reverted (#46).
- Ticket 13 (`wayfinder:grilling`) executed by a hand-dispatched cloud session (#41 → #44),
  which landed 299 lines of ruling **and amendments to `measurement-rules` §8 and
  `quantity-contract` §2/§4** — domain law, amended by a flow with no standing to amend it. #46
  reverted the effort *"byte-for-byte to 25e7dc5"* and changed exactly one line on ticket 13,
  leaving the ruling and both domain-doc amendments on `main` for a day (finished by #52).

**The disclosure worked and did not help.** #44's session named its own violation unprompted —
*"this is a wayfinder:grilling ticket — nominally HITL — and I worked it AFK, since nobody was in
session"* — and the next human read that PR and still reverted the wrong line. That is the
measurement that rules out every honour-based remedy below.

## Decision

**1. An unattended session may work a HITL ticket for facts, and must stop at the first
decision.** Not "refuse at dispatch": `/grilling` already assigns the agent the expensive half
(*"if a fact can be found by exploring the environment, look it up rather than asking me"*), and
that half is exactly what a machine nobody is watching should be doing. It writes findings into
the ticket, sharpens the questions, and stops.

**2. The boundary is two forbidden writes, not a new state.** An unattended session may not
append `## Resolution` and may not set `Status: closed` on a HITL-typed ticket. `Status:` stays
binary. A HITL ticket with the reading done is **open** — which is what open has always meant;
the earlier framing of this as a missing third state was wrong.

**3. A session clears its own claim when it stops, not only when it closes.** Previously the one
claim edit a session made was *"clearing its own in the same edit that closes the ticket."* A
session halting at the HITL boundary closes nothing, and a claim outliving its session is a
ticket the frontier can never see again.

**4. The claim on `main` says whether anyone was watching.** `dispatched <date>` (existing) and
`attended <date>` via `pnpm dispatch --attended` (new). This is the load-bearing choice: a
session cannot push to `main` and never merges its own PR (ADR-0010), so it **cannot
manufacture `attended`**. The commit-time trailer is the surface CI reads; the claim is what
makes the trailer mean something.

**5. Enforcement is in CI, fail-closed, and unknown reads as HITL.** CI refuses a PR that closes
a HITL ticket without a matching attended claim on `main`. Not `pre-push` — that hook runs
inside the container it is meant to constrain.

**6. The rule lives in the wayfinder skill, not `CLAUDE.md`.** `CLAUDE.md` is 5,998 bytes
against ADR-0007's ≤6,000 cap, and ADR-0014 already declined to move that cap (*"a cap that
moves when inconvenient is not a cap"*). `SKILL.md` **already states the law**; what it lacked
was the sentence after it — what an unattended session does instead. That is an amendment to an
existing sentence, not a new rule bidding for two spare bytes.

**7. `grilling` stays the default type.** The collision was never that the type was wrong; it
was that nothing stopped the session at the boundary, which decision 1 now does. Defaulting a
decision map's tickets to `task` — *"the one type that does rather than decides"* — inverts what
the map is for, and fails more quietly.

## Rejected

- **Signing as the proof of attendance.** Ticket 15 already measured it: *"`gpg.ssh.program` is
  an opaque binary that ignores `user.signingkey` — which on a cloud container is a 0-byte file
  — and signs anyway."* A container signs perfectly and indistinguishably.
- **Detecting the container from the `Claude-Session:` trailer.** Runner-supplied, and ADR-0014
  ruled repo law may not depend on runner-supplied context. If the runner drops it the gate
  opens silently.
- **Keying the gate on the claim value alone, fail-open.** #41 claimed ticket 13 as
  `Claimed by: claude/the-rail-gate` — the format `dispatch.mjs` wrote before its rewrite. A
  gate keyed to `dispatched` would have waved #44 straight through. The field is free text whose
  format already changed once, mid-effort.
- **Disclosure as the remedy** — the PR says it was AFK and the merging human catches it. It was
  disclosed, correctly and unprompted, and was not caught.
- **A separate `pnpm attend` verb.** The naming objection is real — "dispatch" means sending work
  to a container, which is the opposite of what an attended claim asserts — but it buys a second
  tool duplicating the first's whole body. `dispatch.mjs`'s header carries the correction
  instead.
- **Keeping the skill's scribe claim** (*"working live with the dispatcher, set the claim as
  their scribe in your first edit"*). That claim lands on the session's branch, invisible on
  `main`, written by the agent — precisely the value the gate must not trust. Removed.

## Consequences

- Attended work gains a step it did not have: you claim on `main` and click, **before** the
  session starts, even when sitting right there. That is the honest cost of making `attended`
  mean something.
- The mechanism — `--attended`, the trailer, the CI gate, their tests — is **not built by this
  ADR**. Wayfinder plans; it does not do. It is ticketed as
  `the-attended-claim-and-its-gate.md`, and until it lands, decision 5 is prose and the boundary
  rests on decisions 1–3 being read.
- Fail-closed on unknown type is safe: the gate fires on the *closing act*, and the three
  evidence artifacts in `harness/tickets/` that carry no `Status:` line
  (`08-cold-proof.md`, `09-cold-proof.md`, `10-replay-proof.md`) can never close.
  `dispatch.mjs` already refuses them — *"no `Status:` field at column 0 — not a tracker
  ticket."*
- This ADR was itself ruled in an attended `/grilling` session, one question at a time, on the
  ticket that describes the failure. The session had no claim to clear: the ticket is an
  unnumbered inbox file, and the rule cannot bind the session that wrote it.
