# The drawing-set revision — what a campaign pins

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

`identity.md` §8 says a campaign is a measurement effort against **"a pinned drawing revision"**
— singular. A real takeoff reads a general-note sheet, a column schedule, several floor plans
and a foundation plan, and §2 *requires* that: authority splits in two, so attributes may come
from a sheet that measures nothing. Meanwhile `quantity-contract.md` §8 already voids a
signature on "a new revision of **any cited drawing**" — plural, and already assumed. The
singular is an under-specification. Charting ruled it becomes an **immutable drawing-set
revision**; this ticket rules the mechanism and writes the amendment.

## The decision

1. **The manifest.** A set revision is an immutable list of `(drawing → revision)` pairs. Is it
   content-addressed (a hash of the pairs, so an identical set is the same revision) or minted?
   `identity.md` §3's zero-minted-ids law governs derived *row keys* — does a set revision count?
2. **Mutation.** Adding, removing or re-revving a member creates a *new* set revision. What
   happens to an in-flight campaign — does it move, fork, or refuse?
3. **The delta.** `takeoff-core` ticket 08 computes a delta drawing-to-drawing and pairs on
   sighting rows scoped per drawing. Set-to-set changes the pairing domain: a member that moved
   *between sheets* between revisions is currently a removal plus a registration. Is that
   correct (honest) or a defect (an ordinal lost for no physical reason)?
4. **Partial re-issue.** Only the plumbing sheets are re-issued. Does the structural scope
   re-present at all? `identity.md` §5's semantic carry says a row re-presents when its cited
   evidence moves — which it did not. State the rule.

## Guardrails

- No coordinates, labels or mutable attributes in any identity key (`identity.md` §2). A set
  revision is provenance and scope, never part of the element identity key.
- The manifest **is** the citation list `quantity-contract.md` §8 needs; if the two can diverge,
  the design is wrong.
- This is a named extension of closed `takeoff-core` work, which pinned single revisions. Say in
  the resolution what it changes there.

## Blocks

Ticket 21 (the run graph) and the MEP-authority fog both wait on this.
