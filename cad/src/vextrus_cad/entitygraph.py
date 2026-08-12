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

import math
import re
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

# The closed entity vocabulary. Model-space types outside it are counted in
# counters.unsupported_by_type, never silently dropped.
ENTITY_TYPES = frozenset(
    {
        "LINE",
        "LWPOLYLINE",
        "POLYLINE",
        "SOLID",
        "CIRCLE",
        "ARC",
        "TEXT",
        "MTEXT",
        "INSERT",
        "DIMENSION",
    }
)

_PATH_TYPES = frozenset({"LWPOLYLINE", "POLYLINE", "SOLID"})
_TEXT_TYPES = frozenset({"TEXT", "MTEXT"})
_HEX_COLOR = re.compile(r"^#[0-9a-f]{6}$")


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
            "unsupported_by_type": {},
        },
        "entities": [],
    }


class ArtifactError(ValueError):
    """The artifact does not satisfy the contract."""


def validate(doc: Any) -> dict[str, Any]:
    """Validate the artifact — envelope, counters, and every entity shape.
    Returns the doc; raises ArtifactError otherwise."""
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
        if not (isinstance(value, int) and not isinstance(value, bool) and value >= 0):
            raise ArtifactError(f"counters.{key} must be a non-negative int")
    if not isinstance(counters.get("explode_truncated"), bool):
        raise ArtifactError("counters.explode_truncated must be a bool")
    for key in ("lost_by_type", "unsupported_by_type"):
        by_type = counters.get(key)
        if not isinstance(by_type, dict) or not all(
            isinstance(k, str) and isinstance(v, int) and not isinstance(v, bool) and v >= 0
            for k, v in by_type.items()
        ):
            raise ArtifactError(f"counters.{key} must map entity type to non-negative int")

    entities = doc.get("entities")
    if not isinstance(entities, list):
        raise ArtifactError("entities must be a list")
    for i, entity in enumerate(entities):
        _validate_entity(entity, f"entities[{i}]")
    return doc


def _is_num(v: Any) -> bool:
    # Non-finite geometry is malformed input and refuses here by name — bare
    # Infinity/NaN also serializes as JSON no strict parser accepts.
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v)


def _is_pt(v: Any) -> bool:
    return isinstance(v, list) and len(v) == 2 and all(_is_num(c) for c in v)


def _chk(cond: bool, msg: str) -> None:
    if not cond:
        raise ArtifactError(msg)


def _validate_entity(e: Any, where: str) -> None:
    _chk(isinstance(e, dict), f"{where} must be an object")
    t = e.get("t")
    _chk(t in ENTITY_TYPES, f"{where}.t must be one of {sorted(ENTITY_TYPES)}")
    src = e.get("src")
    _chk(src is None or isinstance(src, str), f"{where}.src must be null or a source handle")
    _chk("h" in e, f"{where}.h is required (null only on derived entities)")
    h = e.get("h")
    if src is None:
        # The extractor invariant's anchor: `src is None` means original, and
        # an original entity always carries its DXF handle (§2).
        _chk(isinstance(h, str) and h != "", f"{where}.h: an original entity must carry its handle")
    else:
        _chk(h is None or isinstance(h, str), f"{where}.h must be null or a string")
    _chk(isinstance(e.get("layer"), str), f"{where}.layer must be a string")
    color = e.get("color")
    _chk(
        isinstance(color, str) and bool(_HEX_COLOR.fullmatch(color)),
        f"{where}.color must be resolved #rrggbb",
    )

    if t == "LINE":
        _chk(_is_pt(e.get("p1")) and _is_pt(e.get("p2")), f"{where}: LINE needs p1/p2 points")
    elif t in _PATH_TYPES:
        pts = e.get("pts")
        _chk(
            isinstance(pts, list) and len(pts) >= 2 and all(_is_pt(p) for p in pts),
            f"{where}.pts must be >=2 [x, y] points",
        )
        closed = e.get("closed")
        _chk(isinstance(closed, bool), f"{where}.closed must be a bool")
        area = e.get("area")
        if closed:
            _chk(_is_num(area) and area >= 0, f"{where}.area: a closed path carries its area")
        else:
            _chk(area is None, f"{where}.area must be null on an open path")
    elif t == "CIRCLE":
        _chk(_is_pt(e.get("c")), f"{where}.c must be an [x, y] point")
        _chk(_is_num(e.get("r")) and e["r"] >= 0, f"{where}.r must be a non-negative number")
    elif t == "ARC":
        _chk(_is_pt(e.get("c")), f"{where}.c must be an [x, y] point")
        _chk(_is_num(e.get("r")) and e["r"] >= 0, f"{where}.r must be a non-negative number")
        _chk(_is_num(e.get("a1")) and _is_num(e.get("a2")), f"{where}: ARC needs a1/a2 angles")
    elif t in _TEXT_TYPES:
        _chk(isinstance(e.get("text"), str), f"{where}.text must be a string")
        _chk(_is_pt(e.get("p")), f"{where}.p must be an [x, y] point")
        _chk(
            _is_num(e.get("height")) and e["height"] >= 0,
            f"{where}.height must be the non-negative world height",
        )
        _chk(_is_num(e.get("rot")), f"{where}.rot must be a number")
    elif t == "INSERT":
        _chk(isinstance(e.get("name"), str), f"{where}.name must be the block name")
        _chk(_is_pt(e.get("p")), f"{where}.p must be an [x, y] point")
        attrs = e.get("attrs")
        _chk(isinstance(attrs, list), f"{where}.attrs must be a list")
        for j, a in enumerate(attrs if isinstance(attrs, list) else []):
            _chk(
                isinstance(a, dict)
                and isinstance(a.get("tag"), str)
                and isinstance(a.get("text"), str)
                and _is_pt(a.get("p"))
                and _is_num(a.get("height"))
                and a["height"] >= 0,
                f"{where}.attrs[{j}] must be {{tag, text, p, height}}",
            )
    # DIMENSION: common fields only — its rendered geometry is derived entities.
