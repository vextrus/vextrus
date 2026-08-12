"""The extractor laws, proven on the synthetic structural fixture
(cad-ingestion.md §2–§4, §12)."""

import json
import math
from collections import Counter
from pathlib import Path

import ezdxf
import pytest
from ezdxf.colors import aci2rgb
from ezdxf.enums import TextEntityAlignment

from vextrus_cad.entitygraph import validate
from vextrus_cad.ingest import extract, ingest_file

FIXTURES = Path(__file__).parent / "fixtures"
R1 = FIXTURES / "structural-r1.dxf"
R2 = FIXTURES / "structural-r2.dxf"
COMMITTED = FIXTURES / "structural-r1.entitygraph.json"
COMMITTED_R2 = FIXTURES / "structural-r2.entitygraph.json"


@pytest.fixture(scope="module")
def art():
    return ingest_file(R1)


@pytest.fixture(scope="module")
def art2():
    return ingest_file(R2)


def _hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def test_ingest_matches_committed_artifact(art, art2):
    """The committed artifacts are exactly what ingest emits from the committed
    DXFs — the TS side parses the same files, pinning both mirrors to one shape.
    Both revisions are committed: the view partition and the revision delta are
    read on the TS side, which does not run this pipeline."""
    assert art == json.loads(COMMITTED.read_text(encoding="utf-8"))
    assert art2 == json.loads(COMMITTED_R2.read_text(encoding="utf-8"))


def test_sanity_number(art):
    """§12: the pinned reference counts. A lower count after a converter change
    means stale pipeline code — re-earn these numbers deliberately. Re-pinned
    in ticket 05 when the fixture grew from one view to a four-view sheet
    (34/48 → 59/49); the drawing changed, not the converter."""
    assert art["counters"]["original"] == 59
    assert art["counters"]["derived"] == 49
    assert art["counters"]["explode_truncated"] is False
    assert art["counters"]["lost_by_type"] == {}
    assert art["counters"]["unsupported_by_type"] == {"POINT": 4}


def test_artifact_validates_and_units_are_native(art):
    validate(art)
    assert art["units"] == {"insunits": 4, "detected": "mm", "insunits_unmapped": False}


def test_extractor_invariant_src_partitions_the_graph(art):
    """§3: `src is None` is the original predicate; every original carries its
    handle; every derived entity cites an original's handle."""
    originals = [e for e in art["entities"] if e["src"] is None]
    derived = [e for e in art["entities"] if e["src"] is not None]
    assert len(originals) == art["counters"]["original"]
    assert len(derived) == art["counters"]["derived"]
    handles = {e["h"] for e in originals}
    assert all(isinstance(e["h"], str) and e["h"] for e in originals)
    assert all(e["src"] in handles for e in derived)


def test_block_internal_text_is_never_original(art):
    """Richer paint can never invent elements out of block-internal labels (§3).
    The schedule prints the very same strings as *original* cells, so the two
    are told apart by `src` alone — never by what the text says."""
    same_strings = [e for e in art["entities"] if e.get("text") in {"450X600", "8-20mmØ"}]
    paint = [e for e in same_strings if e["src"] is not None]
    cells = [e for e in same_strings if e["src"] is None]
    assert len(paint) == 18  # 9 columns × two nested labels — depth 2 reached
    assert sorted(e["text"] for e in cells) == ["450X600", "8-20mmØ"]  # the schedule row


def test_block_attributes_collect_off_the_insert(art):
    """§3: grid-bubble letters ride the INSERT, never the derived stream."""
    bubbles = [e for e in art["entities"] if e["t"] == "INSERT" and e["name"] == "GRID_BUBBLE"]
    labels = {a["text"] for b in bubbles for a in b["attrs"]}
    assert labels == {"A", "B", "C", "1", "2", "3"}
    streamed = {e.get("text") for e in art["entities"] if e["t"] in ("TEXT", "MTEXT")}
    assert labels & streamed == set()


def test_dimension_text_emits_as_derived(art):
    """§3: a dimension's measurement text is a derived text entity citing the
    DIMENSION's handle — never an original."""
    (dim,) = [e for e in art["entities"] if e["t"] == "DIMENSION"]
    assert dim["src"] is None
    texts = [
        e
        for e in art["entities"]
        if e["t"] in ("TEXT", "MTEXT") and e["src"] == dim["h"]
    ]
    assert [t["text"] for t in texts] == ["5000"]
    assert texts[0]["height"] == 200.0  # world height, not paper size (§4)


def test_world_transform_applies_to_derived_geometry(art):
    """The bubble inserted at 1.5× yields a world-space circle of r=375. Only
    bubble paint is derived; the detail's pile circles are drawn originals."""
    radii = sorted({e["r"] for e in art["entities"] if e["t"] == "CIRCLE" and e["src"]})
    assert radii == [250.0, 375.0]
    originals = sorted({e["r"] for e in art["entities"] if e["t"] == "CIRCLE" and not e["src"]})
    assert originals == [600.0]


def test_colour_resolves_by_layer_zero_rule(art):
    """§4: block contents on layer "0" with BYLAYER take the insert's layer
    colour — the rects go COLUMN-yellow, the bubbles GRID-grey."""
    rects = [e for e in art["entities"] if e["t"] == "LWPOLYLINE" and e["src"] and e["closed"]]
    assert {e["color"] for e in rects if e["area"] == 270000.0} == {_hex(aci2rgb(2))}
    bubbles = [e for e in art["entities"] if e["t"] == "CIRCLE" and e["src"] is not None]
    assert {e["color"] for e in bubbles} == {_hex(aci2rgb(8))}
    grid_lines = [
        e for e in art["entities"] if e["t"] == "LINE" and e["src"] is None and e["layer"] == "GRID"
    ]
    assert {e["color"] for e in grid_lines} == {_hex(aci2rgb(8))}


def test_closed_paths_carry_shoelace_area(art):
    """§4: the slab outline (one bulged corner) flattens under the point cap
    and carries its area; open paths carry null."""
    # Two originals now — the slab and the detail's pile-cap outline; the slab
    # is the larger by an order of magnitude.
    outlines = [e for e in art["entities"] if e["t"] == "LWPOLYLINE" and e["src"] is None]
    assert len(outlines) == 2
    slab = max(outlines, key=lambda e: e["area"])
    assert slab["closed"] is True
    assert 2 < len(slab["pts"]) <= 256
    # 11000×10000 rect plus the outward-bowed east edge (bulge 0.5 over a
    # 10000 chord adds a ~1.7e7 circular segment).
    assert 1.1e8 < slab["area"] < 1.35e8


def test_truncated_budget_reports_per_type_losses(art):
    """§3: a cap that trips must say so — flag plus per-type loss counters,
    never one global scalar."""
    truncated = ingest_file(R1, derived_budget=3)
    counters = truncated["counters"]
    assert counters["explode_truncated"] is True
    assert counters["derived"] == 3
    assert len(truncated["entities"]) == counters["original"] + 3
    lost = counters["lost_by_type"]
    assert lost and all(isinstance(k, str) and v > 0 for k, v in lost.items())
    # Every dropped entity is accounted for, against the untruncated run.
    assert sum(lost.values()) == art["counters"]["derived"] - 3
    validate(truncated)


def test_truncated_depth_counts_unexpanded_inserts():
    """A depth cap that stops nesting counts the unexpanded references."""
    art = ingest_file(R1, explode_depth=1)
    counters = art["counters"]
    assert counters["explode_truncated"] is True
    # 9 nested REBAR_TAG refs + 2 dimension arrow blocks stay unexpanded.
    assert counters["lost_by_type"]["INSERT"] == 11
    validate(art)


def test_unmapped_insunits_flags_never_unitless():
    """§2: an unmapped $INSUNITS code reports null + flag (the legacy defect
    read codes 3, 14–20 as unitless)."""
    doc = ezdxf.readfile(str(R1))
    doc.header["$INSUNITS"] = 14
    art = extract(doc, filename="x.dxf", sha256="0" * 64)
    assert art["units"] == {"insunits": 14, "detected": None, "insunits_unmapped": True}
    validate(art)


def _mem_extract(build):
    doc = ezdxf.new("R2018", setup=True)
    build(doc, doc.modelspace())
    return extract(doc, filename="mem.dxf", sha256="0" * 64)


def test_mesh_polylines_counted_never_crashed():
    """A polyface/polygon-mesh POLYLINE passes the type gate by name but is
    unrepresentable — it must count under a subtype key, not raise."""

    def build(doc, msp):
        face = msp.add_polyface()
        face.append_face([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)])
        msp.add_polymesh((2, 2))

    art = _mem_extract(build)
    assert art["counters"]["original"] == 0
    assert art["counters"]["unsupported_by_type"] == {
        "POLYLINE(POLYFACE)": 1,
        "POLYLINE(POLYMESH)": 1,
    }


def test_degenerate_path_counted_never_emitted():
    """A one-vertex polyline cannot be a path; it counts, the artifact stays
    contract-valid."""

    def build(doc, msp):
        msp.add_lwpolyline([(5, 5)])

    art = _mem_extract(build)
    assert art["entities"] == []
    assert art["counters"]["unsupported_by_type"] == {"LWPOLYLINE(DEGENERATE)": 1}


def test_derived_mtext_carries_world_rotation():
    """Transformed MTEXT stores text_direction; the raw rotation attribute
    silently reads 0 — get_rotation is the lawful accessor."""

    def build(doc, msp):
        blk = doc.blocks.new("TB")
        blk.add_mtext("R", dxfattribs={"char_height": 10})
        msp.add_blockref("TB", (0, 0), dxfattribs={"rotation": 90})

    art = _mem_extract(build)
    (mtext,) = [e for e in art["entities"] if e["t"] == "MTEXT"]
    assert mtext["rot"] == 90.0


def test_aligned_text_records_true_anchor():
    """For non-left justification the raw group-10 insert is not meaningful;
    the record must carry the effective placement."""

    def build(doc, msp):
        text = msp.add_text("C9", dxfattribs={"height": 150})
        text.set_placement((5000, 3000), align=TextEntityAlignment.MIDDLE_CENTER)
        text.dxf.insert = (0, 0)  # stale group 10, routine in authored drawings

    art = _mem_extract(build)
    (text,) = [e for e in art["entities"] if e["t"] == "TEXT"]
    assert text["p"] == [5000.0, 3000.0]


def test_area_survives_point_cap_decimation():
    """The point cap is paint fidelity; the carried area comes from the full
    flattening (a two-bulge circle flattens far past the cap)."""

    def build(doc, msp):
        msp.add_lwpolyline([(0, 0, 1.0), (10000, 0, 1.0)], format="xyb", close=True)

    art = _mem_extract(build)
    (circle,) = art["entities"]
    assert len(circle["pts"]) <= 256
    true_area = math.pi * 5000**2
    assert abs(circle["area"] - true_area) / true_area < 1e-3


def test_revision_pair_ingests_and_differs(art, art2):
    """§12: the revision pair is the identity-stability test bed (tickets
    07–08); here it must ingest cleanly and differ from rev 1 in the columns
    and nothing else — the schedule, the detail and the untyped sketch are
    untouched, so a delta that reports them is reporting noise."""
    validate(art2)
    assert art2["counters"]["original"] == art["counters"]["original"]  # -1 column +1 column

    def texts(a):
        return Counter(e["text"] for e in a["entities"] if e["t"] == "TEXT" and e["src"] is None)

    t1, t2 = texts(art), texts(art2)
    assert t2 - t1 == Counter({"C4": 1})  # the added cantilever column
    assert t1 - t2 == Counter({"C1": 1})  # the deleted corner column
    moved = [e for e in art2["entities"] if e["t"] == "INSERT" and e["p"] == [10300.0, 9000.0]]
    assert len(moved) == 1  # the nudged column
