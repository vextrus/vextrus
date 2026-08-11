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


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(version=2),
        lambda d: d["source"].update(sha256="short"),
        lambda d: d["counters"].update(original=-1),
        lambda d: d["counters"].pop("explode_truncated"),
        lambda d: d["units"].update(detected="furlong"),
    ],
)
def test_mutations_refuse(mutate):
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    mutate(doc)
    with pytest.raises(ArtifactError):
        validate(doc)
