"""The EntityGraph artifact envelope — the contract between cad/ and the app.

The TypeScript mirror lives at src/core/entitygraph.ts (Zod). Both sides parse
the committed fixture at tests/fixtures/entitygraph-minimal.json; drift on
either side goes red in `pnpm verify`.

Founding laws carried from the legacy derivation:
- Fidelity is first-class: a cap that trips must SAY SO (`explode_truncated`)
  and losses are counted per entity type — one global scalar was a named
  legacy defect (nothing downstream could recover what was lost).
- $INSUNITS codes outside the known map must never silently read as unitless:
  `units.detected` is None and `units.insunits_unmapped` is True.
"""

from __future__ import annotations

from typing import Any

ARTIFACT = "vextrus.entitygraph"
VERSION = 1

# $INSUNITS codes we interpret. Anything else: detected=None, insunits_unmapped=True.
INSUNITS_MAP: dict[int, str] = {
    0: "unitless",
    1: "inch",
    2: "foot",
    4: "mm",
    5: "cm",
    6: "m",
}


def empty_artifact(filename: str, sha256: str, insunits: int | None) -> dict[str, Any]:
    """Build a valid artifact with no entities (the skeleton-grade producer)."""
    detected = INSUNITS_MAP.get(insunits) if insunits is not None else None
    return {
        "artifact": ARTIFACT,
        "version": VERSION,
        "source": {"filename": filename, "sha256": sha256},
        "units": {
            "insunits": insunits,
            "detected": detected,
            "insunits_unmapped": insunits is not None and insunits not in INSUNITS_MAP,
        },
        "counters": {
            "original": 0,
            "derived": 0,
            "explode_truncated": False,
            "lost_by_type": {},
        },
        "entities": [],
    }


class ArtifactError(ValueError):
    """The artifact does not satisfy the contract."""


def validate(doc: Any) -> dict[str, Any]:
    """Validate the envelope. Returns the doc; raises ArtifactError otherwise."""
    if not isinstance(doc, dict):
        raise ArtifactError("artifact must be an object")
    if doc.get("artifact") != ARTIFACT:
        raise ArtifactError(f"artifact must be {ARTIFACT!r}")
    if doc.get("version") != VERSION:
        raise ArtifactError(f"version must be {VERSION}")

    source = doc.get("source")
    if not isinstance(source, dict) or not isinstance(source.get("filename"), str):
        raise ArtifactError("source.filename must be a string")
    sha = source.get("sha256")
    if not (isinstance(sha, str) and len(sha) == 64):
        raise ArtifactError("source.sha256 must be a 64-char hex string")

    units = doc.get("units")
    if not isinstance(units, dict):
        raise ArtifactError("units must be an object")
    insunits = units.get("insunits")
    if insunits is not None and not isinstance(insunits, int):
        raise ArtifactError("units.insunits must be int or null")
    detected = units.get("detected")
    if detected is not None and detected not in INSUNITS_MAP.values():
        known = sorted(INSUNITS_MAP.values())
        raise ArtifactError(f"units.detected must be null or one of {known}")
    if not isinstance(units.get("insunits_unmapped"), bool):
        raise ArtifactError("units.insunits_unmapped must be a bool")

    counters = doc.get("counters")
    if not isinstance(counters, dict):
        raise ArtifactError("counters must be an object")
    for key in ("original", "derived"):
        value = counters.get(key)
        if not (isinstance(value, int) and value >= 0):
            raise ArtifactError(f"counters.{key} must be a non-negative int")
    if not isinstance(counters.get("explode_truncated"), bool):
        raise ArtifactError("counters.explode_truncated must be a bool")
    lost = counters.get("lost_by_type")
    if not isinstance(lost, dict) or not all(
        isinstance(k, str) and isinstance(v, int) and v >= 0 for k, v in lost.items()
    ):
        raise ArtifactError("counters.lost_by_type must map entity type to non-negative int")

    if not isinstance(doc.get("entities"), list):
        raise ArtifactError("entities must be a list")
    return doc
