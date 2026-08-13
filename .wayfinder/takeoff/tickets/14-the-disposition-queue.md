# The disposition queue — the surface that must not feel mechanical

wayfinder:prototype
Status: open
Blocked by: 10-the-design-system.md
Claimed by: claude/the-disposition-queue

## Objective

Charting ruled disposition-first as the primary surface — and the CEO named the risk from
experience: **the legacy's disposition surface felt mechanical.** That is the thing this
prototype exists to solve. Build the artifact, put a QS's day in front of us, and decide.

## What the queue already has to contain (the domain law wrote this spec, not us)

Every one of these is a propose/dispose pair already sitting in the domain law with no surface:

- **Discipline confirmation** — drawing-scoped, machine-proposed, human-confirmed, and it
  **fails closed**: an unconfirmed drawing is *not walked at all* (`identity.md` §2). This is the
  first thing a QS ever does and it currently blocks everything.
- **Scale affirmation per group** — ~6–8 acts per project; §5 explicitly warns per-view
  **degenerates into confirm-all**, so the grouping is a UX ruling as much as a data one.
- **Grid georeference disposition** — machine proposes, a view without lawful bubble evidence
  defers with a named reason (`cad-ingestion.md` §8).
- **Transcription, per sheet** — `identity.md` §6 **bans auto-applied regex parses of notes**; a
  misparse is a silent swing on every bar. So note readings *require* a human act per sheet.
- **Mark family and level authoring** — including the `@unregistered:<label>` → `<levelId>`
  one-hop carry (§3), which has no surface and therefore has never moved a disposition.
- **Discrepancies from the AI adversary** (ticket 17) — "the plan places 12 columns, the
  schedule lists 9 marks."
- **Scope declarations** — human-only causes, with `bd-authority.md`'s reminder that *name the
  evidence or lose the cause*.

## The decision

1. **Does it feel like an instrument or like data entry?** That is the prototype's actual
   question. A queue of 200 confirm-clicks is the failure mode §7 already names as
   `confirm-all`; the design must make judgement feel like judgement and batch what is not.
2. **Where the drawing sits.** Charting ruled canvas as first-class: a decision shows its
   evidence, zoomed to the cited source keys, highlighted. Prototype that pairing — it is the
   main reason to believe this will not feel mechanical.
3. **Granularity of an act.** `identity.md` §7: acts are recorded **at the granularity
   performed** — a confirm-all is *one* act with N subjects. That is a UI decision with an audit
   consequence.
4. **What is never in the queue.** §7's warning is that universal per-row confirmation
   degenerates, and **the money is in absence, which disposing rows never meets.** So the queue
   must foreground absence over rows. Prototype what that looks like.

## Guardrails

- Under 200 ms per interaction (map's non-functional bar).
- A deferral carries actor, timestamp, a **closed cause enum shared with the machine's own
  refusals**, a scope reference, and a note that is **never itself the exclusion** (§7).
- Throwaway artifact. `/prototype` is the skill.
