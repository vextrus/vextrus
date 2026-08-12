import json
from pathlib import Path

import pytest

from vextrus_cad.entitygraph import ArtifactError, empty_artifact, validate

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
    "src": None,
}
_CLOSED_WITHOUT_AREA = {
    "h": "FF",
    "t": "LWPOLYLINE",
    "layer": "0",
    "color": "#ffffff",
    "src": None,
    "pts": [[0, 0], [1, 0], [1, 1]],
    "closed": True,
    "area": None,
}
_LINE = {"h": "AA", "t": "LINE", "layer": "0", "color": "#ffffff", "src": None}
_NON_FINITE = {**_LINE, "p1": [1e999, 0.0], "p2": [1.0, 1.0]}
_DERIVED_H_KEY_ABSENT = {"t": "LINE", "layer": "0", "color": "#ffffff", "src": "AA",
                         "p1": [0.0, 0.0], "p2": [1.0, 1.0]}
_TRAILING_NEWLINE_COLOR = {**_LINE, "color": "#ffffff\n", "p1": [0.0, 0.0], "p2": [1.0, 1.0]}


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(version=2),
        lambda d: d["source"].update(sha256="short"),
        lambda d: d["counters"].update(original=-1),
        lambda d: d["counters"].pop("explode_truncated"),
        lambda d: d["counters"].pop("unsupported_by_type"),
        lambda d: d["counters"].update(original=True),  # bools are not counts
        lambda d: d["counters"].update(lost_by_type={"LINE": True}),
        lambda d: d["units"].update(detected="furlong"),
        lambda d: d["entities"].append(_ORIGINAL_WITHOUT_HANDLE),
        lambda d: d["entities"].append(_CLOSED_WITHOUT_AREA),
        lambda d: d["entities"].append(_NON_FINITE),
        lambda d: d["entities"].append(_DERIVED_H_KEY_ABSENT),
        lambda d: d["entities"].append(_TRAILING_NEWLINE_COLOR),
    ],
)
def test_mutations_refuse(mutate):
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    mutate(doc)
    with pytest.raises(ArtifactError):
        validate(doc)
