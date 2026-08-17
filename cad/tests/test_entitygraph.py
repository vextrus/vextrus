import json
from pathlib import Path

import pytest

from vextrus_cad.entitygraph import (
    ArtifactError,
    empty_artifact,
    empty_counters,
    paper_space,
    validate,
)

FIXTURE = Path(__file__).parent / "fixtures" / "entitygraph-minimal.json"


def test_builder_matches_committed_fixture():
    """The committed fixture is exactly what the builder emits — the TS side
    parses the same file, so this pins both mirrors to one shape."""
    built = empty_artifact("fixture.dxf", "0" * 64, insunits=1)
    assert built == json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_fixture_validates():
    validate(json.loads(FIXTURE.read_text(encoding="utf-8")))


def test_unmapped_insunits_is_never_silently_unitless():
    art = empty_artifact("x.dxf", "0" * 64, insunits=14)
    assert art["units"]["detected"] is None
    assert art["units"]["insunits_unmapped"] is True
    validate(art)


_ORIGINAL_WITHOUT_HANDLE = {
    "h": None,
    "t": "DIMENSION",
    "layer": "0",
    "color": "#ffffff",
    "space": "model",
    "src": None,
}
_CLOSED_WITHOUT_AREA = {
    "h": "FF",
    "t": "LWPOLYLINE",
    "layer": "0",
    "color": "#ffffff",
    "space": "model",
    "src": None,
    "pts": [[0, 0], [1, 0], [1, 1]],
    "closed": True,
    "area": None,
}
_LINE = {"h": "AA", "t": "LINE", "layer": "0", "color": "#ffffff", "space": "model", "src": None}
_NON_FINITE = {**_LINE, "p1": [1e999, 0.0], "p2": [1.0, 1.0]}
_DERIVED_H_KEY_ABSENT = {"t": "LINE", "layer": "0", "color": "#ffffff", "space": "model",
                         "src": "AA", "p1": [0.0, 0.0], "p2": [1.0, 1.0]}
_TRAILING_NEWLINE_COLOR = {**_LINE, "color": "#ffffff\n", "p1": [0.0, 0.0], "p2": [1.0, 1.0]}
_GOOD_LINE = {**_LINE, "p1": [0.0, 0.0], "p2": [1.0, 1.0]}
_NO_SPACE = {k: v for k, v in _GOOD_LINE.items() if k != "space"}
_UNKNOWN_SPACE = {**_GOOD_LINE, "space": "sheet:S-01"}
_EMPTY_LAYOUT_SPACE = {**_GOOD_LINE, "space": "paper:"}
# An entity in a layout the inventory never shipped makes `dropped_contentless`
# a lie — the two readings of the same drawing must agree (ADR-0009).
_ORPHAN_LAYOUT_SPACE = {**_GOOD_LINE, "space": paper_space("Layout1")}

# One inventory entry: name, bbox, and the fidelity of that space alone.
_COUNTERS = empty_counters()
_LAYOUT = {"name": "L1", "bbox": None, "counters": _COUNTERS}


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(version=3),
        lambda d: d["source"].update(sha256="short"),
        lambda d: d["counters"].update(original=-1),
        lambda d: d["counters"].pop("explode_truncated"),
        lambda d: d["counters"].pop("unsupported_by_type"),
        lambda d: d["counters"].pop("flatten_capped"),
        lambda d: d["counters"].update(flatten_capped=-1),
        lambda d: d.pop("extents"),
        lambda d: d["extents"].update(bbox=[0.0, 0.0, 1.0]),
        lambda d: d["extents"].update(bbox=[1.0, 0.0, 0.0, 1.0]),  # maxx below minx
        lambda d: d["extents"].update(rejected=-1),
        lambda d: d.pop("layouts"),
        lambda d: d["layouts"].update(dropped_contentless=True),  # bools are not counts
        lambda d: d["layouts"]["paper"].append(_LAYOUT | {"name": ""}),
        lambda d: d["layouts"]["paper"].append(_LAYOUT | {"name": "a:b"}),
        lambda d: d["layouts"]["paper"].extend([_LAYOUT, _LAYOUT]),  # listed twice
        # A layout's fidelity is named where its space is named; an entry
        # without it, or with a broken block, is not a layout inventory.
        lambda d: d["layouts"]["paper"].append(
            {k: v for k, v in _LAYOUT.items() if k != "counters"}
        ),
        lambda d: d["layouts"]["paper"].append(
            _LAYOUT | {"counters": _COUNTERS | {"flatten_capped": -1}}
        ),
        lambda d: d["counters"].update(original=True),  # bools are not counts
        lambda d: d["counters"].update(lost_by_type={"LINE": True}),
        lambda d: d["units"].update(detected="furlong"),
        lambda d: d["entities"].append(_ORIGINAL_WITHOUT_HANDLE),
        lambda d: d["entities"].append(_CLOSED_WITHOUT_AREA),
        lambda d: d["entities"].append(_NON_FINITE),
        lambda d: d["entities"].append(_DERIVED_H_KEY_ABSENT),
        lambda d: d["entities"].append(_TRAILING_NEWLINE_COLOR),
        lambda d: d["entities"].append(_NO_SPACE),
        lambda d: d["entities"].append(_UNKNOWN_SPACE),
        lambda d: d["entities"].append(_EMPTY_LAYOUT_SPACE),
        lambda d: d["entities"].append(_ORPHAN_LAYOUT_SPACE),
    ],
)
def test_mutations_refuse(mutate):
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    mutate(doc)
    with pytest.raises(ArtifactError):
        validate(doc)


def test_a_shipped_layout_admits_its_entities():
    """The mirror of the orphan refusal: once the layout is in the inventory,
    an entity marked with it validates."""
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    doc["layouts"]["paper"].append(
        _LAYOUT | {"name": "Layout1", "bbox": [0.0, 0.0, 420.0, 297.0]}
    )
    doc["entities"].append(_ORPHAN_LAYOUT_SPACE)
    validate(doc)
