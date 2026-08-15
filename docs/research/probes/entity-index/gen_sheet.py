"""Scale corpus for the entity-index probe: a structural sheet at N× the fixture.

Not a fixture and not pipeline code. It reproduces `cad/tests/fixtures/gen_structural.py`'s
drafting conventions — block-referenced columns with internal paint and a nested rebar tag,
gridlines with attributed bubbles, a schedule view, a caption per view — and scales the column
grid until the sheet carries roughly the requested number of ORIGINAL entities. That ratio of
original to derived paint is the thing the index has to survive, so it is taken from the real
extractor rather than assumed.

    uv run --with ezdxf python docs/research/probes/entity-index/gen_sheet.py \
        --originals 10000 --out .data/entityindex/sheet-00.dxf

Sheets differ only by `--seed`, which jitters column positions; every sheet is the same
species of drawing, which is what a 50-sheet set of one building actually looks like.
"""

from __future__ import annotations

import argparse
import math
import os
import random
import subprocess
import sys
from pathlib import Path

if os.environ.get("PYTHONHASHSEED") != "0":
    raise SystemExit(
        subprocess.call([sys.executable, *sys.argv], env={**os.environ, "PYTHONHASHSEED": "0"})
    )

import ezdxf
from ezdxf.document import Drawing

ezdxf.options.write_fixed_meta_data_for_testing = True

BAY_X = 5000.0
BAY_Y = 4500.0

# Originals contributed per column bay (the INSERT and its mark TEXT); the block's outline,
# size text and nested rebar tag are all derived paint and are not counted here.
ORIGINALS_PER_BAY = 2


def build(n_originals: int, seed: int) -> Drawing:
    rng = random.Random(seed)
    # bays = the square grid that lands nearest the requested original count once the
    # gridlines, bubbles and schedule rows are paid for.
    side = max(2, int(math.sqrt(max(n_originals - 200, 4) / ORIGINALS_PER_BAY)))

    doc = ezdxf.new("R2018", setup=True)
    doc.header["$INSUNITS"] = 4  # mm
    for name, color in (
        ("GRID", 8),
        ("COLUMN", 2),
        ("SLAB", 3),
        ("ANNO", 7),
        ("DIM", 5),
        ("TITLE", 7),
    ):
        doc.layers.add(name, color=color)

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
    width, height = side * BAY_X, side * BAY_Y

    def axis_label(i: int) -> str:
        s = ""
        while True:
            s = chr(ord("A") + i % 26) + s
            i = i // 26 - 1
            if i < 0:
                return s

    for i in range(side):
        x = i * BAY_X
        msp.add_line((x, -1500), (x, height + 1500), dxfattribs={"layer": "GRID"})
        bref = msp.add_blockref("GRID_BUBBLE", (x, height + 2000), dxfattribs={"layer": "GRID"})
        bref.add_auto_attribs({"LABEL": axis_label(i)})
    for j in range(side):
        y = j * BAY_Y
        msp.add_line((-1500, y), (width + 1500, y), dxfattribs={"layer": "GRID"})
        bref = msp.add_blockref("GRID_BUBBLE", (-2000, y), dxfattribs={"layer": "GRID"})
        bref.add_auto_attribs({"LABEL": str(j + 1)})

    marks = ("C1", "C2", "C3")
    for i in range(side):
        for j in range(side):
            # jitter well under the bay so placement still reads a grid intersection
            x = i * BAY_X + rng.uniform(-40.0, 40.0)
            y = j * BAY_Y + rng.uniform(-40.0, 40.0)
            msp.add_blockref("COL_450X600", (x, y), dxfattribs={"layer": "COLUMN"})
            mark = marks[(i + j) % len(marks)]
            msp.add_text(mark, dxfattribs={"layer": "ANNO", "height": 150}).set_placement(
                (x + 300, y + 350)
            )

    msp.add_lwpolyline(
        [(-500, -500), (width + 500, -500), (width + 500, height + 500), (-500, height + 500)],
        close=True,
        dxfattribs={"layer": "SLAB"},
    )
    msp.add_mtext("TYPICAL FLOOR PLAN", dxfattribs={"layer": "TITLE", "char_height": 400}).set_location(
        (width / 3, -2500)
    )

    sx = width + 8000.0
    for r, row in enumerate(
        [("MARK", "SIZE", "MAIN BAR"), ("C1", "450X600", "8-20mmØ"),
         ("C2", "375X450", "6-20mmØ"), ("C3", "300X375", "6-16mmØ")]
    ):
        for c, cell in enumerate(row):
            msp.add_text(cell, dxfattribs={"layer": "ANNO", "height": 150}).set_placement(
                (sx + c * 3500.0, height - r * 1200.0)
            )
    msp.add_mtext("COLUMN SCHEDULE", dxfattribs={"layer": "TITLE", "char_height": 400}).set_location(
        (sx, height - 5200.0)
    )
    return doc


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--originals", type=int, default=10000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    doc = build(args.originals, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    doc.saveas(args.out)
    print(f"{args.out} written")


if __name__ == "__main__":
    main()
