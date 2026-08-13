# The paper-space viewport — a fifth rung, or the sheet-layout lane's limit

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Surfaced closing *The scale group and its affirmation* (`tickets/12-the-scale-group.md`), which
ruled the four-rung ladder but found a fifth candidate the ladder does not mention.

A DXF **paper-space layout** carries VIEWPORT entities, and a viewport carries the exporter's own
model→paper ratio — the transform the plot *actually used*. It is not a printed scale note: §5's
ban is on **text a human typed**, measured (the sheets printing `NOT TO SCALE` were the ones to
scale), and a viewport transform is machine-authored geometry that the plotter obeyed. On the
face of it this is the strongest non-human evidence in the file, and it is currently unranked.

## The decision

1. **Does it rank, and where?** Above the file-units header is nearly certain (it observes the
   plot ratio directly rather than assuming 1:1). Whether it outranks the overridden dimension
   ratio — or even grid match — is open. Note ticket 12's rule that **grouping evidence must be
   over-determined**: a viewport ratio is a single number with no internal check, which is the
   test that ruled text-height matching out. Does the same test demote it, or is the distinction
   that a viewport is *authored by the machine that plotted* rather than coincidence?
2. **Verification.** Ticket 12 ruled verification is two agreeing observations per axis, which
   silently demoted the units header to corroboration-only because a file holds exactly one. A
   file holds *many* viewports — but they are copies of one exporter setting, not independent
   observations. Rule whether a second viewport verifies the first or merely repeats it.
3. **The partition problem.** `takeoff-core`'s view partition and `cad-ingestion.md` §7 work in
   **model space**, keyed on caption grammar. A paper-space layout is a different partition
   entirely, and a viewport's clip names a model-space *region*, not a view. Establish whether a
   viewport can even be joined to the views ticket 12's `view_calibrations` keys on — if it
   cannot, the rung has no subject and the question closes.
4. **§5's sheet-layout clause.** *"A sheet-layout lane may assume a convention to partition and
   declare, but nothing on that lane may multiply geometry into a stored dimension."* This is
   the clause a viewport rung must live under, and it reads on its face as a prohibition: the
   lane may **partition**, never **value**. Rule whether that sentence already answers this
   ticket — in which case the finding is that the ladder is complete and the record should say
   so — or whether a viewport transform is the one thing on that lane that is not an assumed
   convention.
5. **The other lanes.** A vector PDF is *already* paper space, which is why ticket 06 found
   `/UserUnit` at 1.0 in 14 of 14 files and `/Measure` in none: the plot ratio was consumed at
   export and left no trace. If the ruling admits a DXF viewport rung, say explicitly why the
   PDF lane cannot have it, so 23's lane fidelity declaration can carry the asymmetry.

## Guardrails

- Ticket 12's ladder is lane-independent in **order**; a lane never re-ranks to compensate for a
  rung it lacks. A fifth rung is inserted once, for every lane, or not at all.
- Whatever ranks here is still subject to ticket 12's verification rule and its ±1% band — a
  rung that cannot be verified is corroboration-only, however strong it looks.
- `measurement-rules.md` §5's strict unit lane binds: an unmapped unit resolves to **null**.
