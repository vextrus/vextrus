# Strike the grid-spacing rank from the scale ladder (`measurement-rules.md` §5)

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

`measurement-rules.md` §5 states a four-rank precedence for scale evidence: QS two-point → grid
spacing match → overridden dimension ratio (style factor divided out) → file units header.

[Ticket 12](../tickets/12-the-scale-group.md) ruled **rank 2 does not survive**, and the domain doc
still carries it. The map's Notes are explicit that domain-law amendments each get their own ticket
and none may be made in passing — the overreach #44 committed and #52 undid — so 12 filed this
rather than editing §5 itself.

## The measurement that forced it

`grid.ts`'s `minSpacing` is "computed here and nowhere else", in **native drawing units,
uninterpreted**. In model space a plan is drawn 1:1, so that number is the **building's grid module**
— not a plot scale. It follows that:

- two views at *different* scales over the same grid produce the *same* `minSpacing`;
- two views at the *same* scale over different bay grids produce *different* `minSpacing`.

Neither necessary nor sufficient. To become a scale observation it needs a real-world spacing to
match against, and the only sources are a dimension string along the grid (rank 3's input) or a QS
stating the module (rank 1 in a hat). It was never an independent rank.

Ticket 12 §4 also ruled the consequence: with rank 2 struck, the **arc-fit question dissolves** —
CIRCLE recovery on the PDF lane existed to feed bubbles to this rank, and nothing in the scale
ladder needs it now.

## The decision

1. **Strike rank 2 from §5's ladder**, renumbering to three ranks, and record why in the doc rather
   than leaving a silent gap — a reader who finds a three-rank ladder should not have to
   rediscover that grid spacing was tried.
2. **Rule where the corroboration goes, if anywhere.** 12 rejected rank 2 *as evidence* but noted it
   is a plausible **verification**: an independently-derived scale predicting an absurd grid module
   (a 47m bay) is a real signal. Decide whether §5 gains that as a sanity check alongside the
   agreement test, or whether it is dropped entirely. 12 deliberately did not rule this.
3. **State the per-lane consequence in §5**, since it is now uneven and load-bearing: rank 4 is
   *complete* on DWG with a mapped non-zero `$INSUNITS` (model space at 1:1, not a degraded rank 1),
   rank 3 has no input on either lane until the extractor widens
   (`inbox/dwg-dimension-attributes.md`), and the PDF lane is **rank 1 only**.

## Guardrails

- 12's rulings are the input, not the subject — this ticket amends the doc to match a decision
  already made, and reopens only item 2, which 12 left open on purpose.
- `cad-ingestion.md` §8/§9 describe grid detection and the placement constants as shares of
  `minSpacing`. Those uses are **untouched**: `minSpacing` remains correct and load-bearing for
  placement: what it is not is *scale evidence*.
