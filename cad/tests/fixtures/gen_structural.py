"""Synthetic structural fixtures — regenerable, byte-stable (cad-ingestion.md §12).

Rev 1 is a **sheet**, not a single drawing: four captioned views laid out with
empty strips between them, the way a real structural sheet is drafted.

- `TYPICAL FLOOR PLAN` — a 3×3-grid floor plan: grid lines with bubble blocks
  (attribute labels), nine column block references (block-internal size text
  and a nested rebar-tag block — the extractor-invariant test bed), column
  marks, a slab outline with a bulged corner, an arc, a stray POINT (exercises
  the unsupported counter), one rendered linear dimension.
- `COLUMN SCHEDULE` — a header row and three mark rows. Its cells repeat the
  plan's mark strings (`C1`) and the block-internal size strings (`450X600`):
  a partition that leaks schedule text into the plan invents phantom columns,
  which is over-measurement — the §7 view law's whole point.
- `PLAN OF PILE CAP PC-1` — a member-scoped plan: §7 names it a *detail*,
  never countable, though its two pile circles read exactly like countable
  members. It also carries a grid bubble, so ticket 06 can prove a detail's
  grid stamp never shifts an axis (§8) without re-pinning these fixtures.
- `SK-04 REF. AS-BUILT` — a caption the grammar cannot classify: its view is
  honestly untyped, never guessed.

Plus one stray line parked far outside every view (the xref junk real drawings
carry) — it lands in `unassigned`, named, never dropped.

`sheet-paperspace` is the third fixture and a different test bed: a drawing
whose **paper space carries content**, which the structural pair does not have
(their only layout is the stock, empty `Layout1`). It is what proves EntityGraph
v2's additivity where it can actually fail — three layouts, three dispositions:

- `A3 SHEET` — a title block, a sheet note and the VIEWPORT through which the
  sheet looks at model space. Shipped, with its own bbox and its own counters:
  the VIEWPORT the vocabulary does not admit is named *there*, and the envelope's
  counters stay model space's, exactly as v1 meant them.
- `KEY PLAN` — a layout holding only a VIEWPORT, the ordinary AutoCAD sheet that
  carries nothing of its own. Still shipped (bbox null): it *held* content, so
  calling its drop content-less would be a false name for the drop (§3).
- `Layout1` — the stock layout, empty. The one true content-less drop.

Rev 2 is rev 1's revision pair: one column nudged, one deleted, one added,
retitled; every other view is untouched, so a revision delta reads as columns
and nothing else. The identity-stability fixture for tickets 07–08.

Regenerate (byte-identical while ezdxf stays pinned):

    uv run python tests/fixtures/gen_structural.py

then refresh the committed ingest artifact (--out, never shell redirection —
Windows PowerShell 5.1 re-encodes stdout as UTF-16 and corrupts it):

    uv run python -m vextrus_cad ingest tests/fixtures/structural-r1.dxf \
        --out tests/fixtures/structural-r1.entitygraph.json

for each of structural-r1, structural-r2 and sheet-paperspace.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ezdxf's OBJECTS-section order leaks Python's hash seed; pin it or the bytes
# flip between runs.
if os.environ.get("PYTHONHASHSEED") != "0":
    import subprocess

    raise SystemExit(
        subprocess.call([sys.executable, *sys.argv], env={**os.environ, "PYTHONHASHSEED": "0"})
    )

import ezdxf
from ezdxf.document import Drawing

ezdxf.options.write_fixed_meta_data_for_testing = True

HERE = Path(__file__).parent

GRID_X = {"A": 0.0, "B": 5000.0, "C": 10000.0}
GRID_Y = {"1": 0.0, "2": 4500.0, "3": 9000.0}

# Column marks per grid intersection: corners C1, edges C2, centre C3.
MARKS = {
    ("A", "1"): "C1",
    ("C", "1"): "C1",
    ("A", "3"): "C1",
    ("C", "3"): "C1",
    ("B", "1"): "C2",
    ("A", "2"): "C2",
    ("C", "2"): "C2",
    ("B", "3"): "C2",
    ("B", "2"): "C3",
}

# The schedule view: header row, then one row per mark family. The size and
# rebar strings are deliberately the same strings the column block paints
# internally — original schedule text and derived block paint must stay
# distinguishable by `src` alone (§3), never by their content.
SCHEDULE_COLS = (20000.0, 23500.0, 27000.0)
SCHEDULE_ROWS = (
    (6000.0, ("MARK", "SIZE", "MAIN BAR")),
    (4500.0, ("C1", "450X600", "8-20mmØ")),
    (3300.0, ("C2", "375X450", "6-20mmØ")),
    (2100.0, ("C3", "300X375", "6-16mmØ")),
)


def build(rev: int) -> Drawing:
    doc = ezdxf.new("R2018", setup=True)
    doc.header["$INSUNITS"] = 4  # mm — native drawing units, reported never interpreted

    doc.layers.add("GRID", color=8)
    doc.layers.add("COLUMN", color=2)
    doc.layers.add("SLAB", color=3)
    doc.layers.add("ANNO", color=7)
    doc.layers.add("DIM", color=5)
    doc.layers.add("TITLE", color=7)

    # Block contents stay on layer "0" with BYLAYER colour so they take the
    # insert's layer colour — the classic CAD convention the resolver must honour.
    bub = doc.blocks.new("GRID_BUBBLE")
    bub.add_circle((0, 0), 250)
    bub.add_attdef("LABEL", insert=(-100, -100), dxfattribs={"height": 200})

    tag = doc.blocks.new("REBAR_TAG")
    tag.add_line((0, 0), (150, 150))
    tag.add_text("8-20mmØ", dxfattribs={"height": 80}).set_placement((180, 150))

    col = doc.blocks.new("COL_450X600")
    col.add_lwpolyline([(-225, -300), (225, -300), (225, 300), (-225, 300)], close=True)
    col.add_text("450X600", dxfattribs={"height": 100}).set_placement((-200, 320))
    col.add_blockref("REBAR_TAG", (0, 0))

    msp = doc.modelspace()

    for label, x in GRID_X.items():
        msp.add_line((x, -1500), (x, 10500), dxfattribs={"layer": "GRID"})
        scale = 1.5 if label == "C" else 1.0  # one scaled bubble pins world transforms
        bref = msp.add_blockref(
            "GRID_BUBBLE",
            (x, 11000),
            dxfattribs={"layer": "GRID", "xscale": scale, "yscale": scale},
        )
        bref.add_auto_attribs({"LABEL": label})
    for label, y in GRID_Y.items():
        msp.add_line((-1500, y), (11500, y), dxfattribs={"layer": "GRID"})
        bref = msp.add_blockref("GRID_BUBBLE", (-2000, y), dxfattribs={"layer": "GRID"})
        bref.add_auto_attribs({"LABEL": label})

    def column(x: float, y: float, mark: str) -> None:
        msp.add_blockref("COL_450X600", (x, y), dxfattribs={"layer": "COLUMN"})
        text = msp.add_text(mark, dxfattribs={"layer": "ANNO", "height": 150})
        text.set_placement((x + 300, y + 350))

    marks = dict(MARKS)
    if rev == 2:
        marks.pop(("A", "3"))  # column dropped in the revision
    for (gx, gy), mark in marks.items():
        x, y = GRID_X[gx], GRID_Y[gy]
        if rev == 2 and (gx, gy) == ("C", "3"):
            x += 300.0  # column nudged — identity must survive (ticket 05)
        column(x, y, mark)
    if rev == 2:
        column(12000.0, 9000.0, "C4")  # new cantilever column

    msp.add_lwpolyline(
        [(-500, -500, 0.0), (10500, -500, 0.5), (10500, 9500, 0.0), (-500, 9500, 0.0)],
        format="xyb",
        close=True,
        dxfattribs={"layer": "SLAB"},
    )
    msp.add_arc((11500, 4500), 800, 270, 90, dxfattribs={"layer": "SLAB"})
    msp.add_point((0, 0), dxfattribs={"layer": "ANNO"})  # exercises the unsupported counter
    dim = msp.add_linear_dim(
        base=(0, -1200),
        p1=(0, 0),
        p2=(5000, 0),
        dxfattribs={"layer": "DIM"},
        # The stock EZDXF style has dimlfac=100 and paper-size text; without
        # these the rendered measurement reads 500000 at height 0.25.
        override={"dimtxt": 200, "dimlfac": 1.0, "dimasz": 150, "dimexo": 50, "dimexe": 80},
    )
    dim.render()
    def caption(text: str, at: tuple[float, float]) -> None:
        """A view caption: the sheet's tallest text, set below its view — the
        BD drafting convention the partition reads (never a layer name)."""
        msp.add_mtext(text, dxfattribs={"layer": "TITLE", "char_height": 400}).set_location(at)

    def anno(text: str, at: tuple[float, float]) -> None:
        msp.add_text(text, dxfattribs={"layer": "ANNO", "height": 150}).set_placement(at)

    caption(f"TYPICAL FLOOR PLAN (R{rev})", (3000, -2500))

    # ── The schedule view — type evidence only; it may never yield instances.
    for y, row in SCHEDULE_ROWS:
        for x, cell in zip(SCHEDULE_COLS, row, strict=True):
            anno(cell, (x, y))
    caption("COLUMN SCHEDULE", (20000, 100))

    # ── The member-scoped detail — "PLAN OF <subject>" is a detail (§7), even
    #    though its pile circles look exactly like countable members.
    msp.add_lwpolyline(
        [(20500, 14000), (26500, 14000), (26500, 19000), (20500, 19000)],
        close=True,
        dxfattribs={"layer": "SLAB"},
    )
    for x in (22000.0, 25000.0):
        msp.add_circle((x, 16500), 600, dxfattribs={"layer": "COLUMN"})
    anno("PC-1", (23200, 16800))
    detail_bubble = msp.add_blockref("GRID_BUBBLE", (20500, 19800), dxfattribs={"layer": "GRID"})
    detail_bubble.add_auto_attribs({"LABEL": "A"})  # a detail's grid stamp (§8, ticket 06)
    caption("PLAN OF PILE CAP PC-1", (20000, 12500))

    # ── A caption no grammar classifies: the view is honestly untyped.
    msp.add_line((-14000, 0), (-9000, 0), dxfattribs={"layer": "ANNO"})
    msp.add_line((-14000, 0), (-14000, 4000), dxfattribs={"layer": "ANNO"})
    msp.add_line((-14000, 4000), (-9000, 0), dxfattribs={"layer": "ANNO"})
    anno("XX", (-12000, 1500))
    caption("SK-04 REF. AS-BUILT", (-14000, -2000))

    # Xref junk parked far outside every view — unassigned, named, never dropped.
    msp.add_line((60000, 60000), (60800, 60300), dxfattribs={"layer": "GRID"})

    return doc


def build_sheet() -> Drawing:
    """The paper-space fixture (ADR-0009). Small on purpose: it exists to make
    the space marker, the layout inventory and the per-space counters provable,
    and every entity in it is there to name one disposition."""
    doc = ezdxf.new("R2018", setup=True)
    doc.header["$INSUNITS"] = 4
    doc.layers.add("SLAB", color=3)
    doc.layers.add("TITLE", color=7)

    msp = doc.modelspace()
    msp.add_lwpolyline(
        [(0, 0), (10000, 0), (10000, 6000), (0, 6000)],
        close=True,
        dxfattribs={"layer": "SLAB"},
    )
    msp.add_text("GROUND FLOOR PLAN", dxfattribs={"layer": "TITLE", "height": 400})
    # A stray POINT in model space: the envelope's unsupported counter must
    # read this and only this, however much sheet furniture the layouts carry.
    msp.add_point((0, 0), dxfattribs={"layer": "SLAB"})

    # The drafted sheet: a title block, a sheet note, and the viewport it looks
    # at model space through — sheet furniture, never measured.
    sheet = doc.layouts.new("A3 SHEET")
    sheet.add_lwpolyline(
        [(0, 0), (420, 0), (420, 297), (0, 297)],
        close=True,
        dxfattribs={"layer": "TITLE"},
    )
    sheet.add_text("S-01", dxfattribs={"layer": "TITLE", "height": 5}).set_placement((360, 10))
    sheet.add_viewport(
        center=(210, 160),
        size=(380, 240),
        view_center_point=(5000, 3000),
        view_height=7000,
    )

    # A layout that holds only a viewport: it has content, but none this
    # vocabulary can represent. Shipped with a null bbox and counters that name
    # what it held — never counted as content-less.
    key_plan = doc.layouts.new("KEY PLAN")
    key_plan.add_viewport(
        center=(100, 100),
        size=(160, 120),
        view_center_point=(5000, 3000),
        view_height=9000,
    )

    # The stock `Layout1` stays empty — the one true content-less drop.
    return doc


def main() -> None:
    for rev in (1, 2):
        out = HERE / f"structural-r{rev}.dxf"
        build(rev).saveas(out)
        print(f"wrote {out}")
    out = HERE / "sheet-paperspace.dxf"
    build_sheet().saveas(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
