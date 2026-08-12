"""Synthetic structural fixtures — regenerable, byte-stable (cad-ingestion.md §12).

Rev 1 is a small 3×3-grid floor plan: grid lines with bubble blocks (attribute
labels), nine column block references (block-internal size text and a nested
rebar-tag block — the extractor-invariant test bed), column marks, a slab
outline with a bulged corner, an arc, a stray POINT (exercises the unsupported
counter), one rendered linear dimension, and a title. Rev 2 is its revision
pair: one column nudged, one deleted, one added, retitled — the
identity-stability fixture for ticket 05.

Regenerate (byte-identical while ezdxf stays pinned):

    uv run python tests/fixtures/gen_structural.py

then refresh the committed ingest artifact (--out, never shell redirection —
Windows PowerShell 5.1 re-encodes stdout as UTF-16 and corrupts it):

    uv run python -m vextrus_cad ingest tests/fixtures/structural-r1.dxf \
        --out tests/fixtures/structural-r1.entitygraph.json
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
    title = msp.add_mtext(
        f"TYPICAL FLOOR PLAN (R{rev})", dxfattribs={"layer": "TITLE", "char_height": 400}
    )
    title.set_location((3000, -2500))

    return doc


def main() -> None:
    for rev in (1, 2):
        out = HERE / f"structural-r{rev}.dxf"
        build(rev).saveas(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
