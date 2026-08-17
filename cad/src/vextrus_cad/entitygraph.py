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

Version 2 (ADR-0009, cad-ingestion.md §4's amendment of 2026-08-16) carries the
four facts the app can never recover, because the CLI is one-shot and nothing
downstream may re-open the drawing:
- a **space marker** per entity (`space`): model space, or the named paper
  layout — §7's law opens "every model-space original entity", and v1 recorded
  no such distinction;
- the **layout inventory** (`layouts`): each shipped paper layout's bbox, plus
  the count of layouts dropped as content-less — a drop nobody counted is the
  silent loss §3 forbids;
- the **robust-extents record** (`extents`): the model-space extents and the
  count of entities §4's inter-percentile window rejected;
- the **flatten point-cap counter** (`counters.flatten_capped`): unlike
  `explode_truncated`, a tripped point cap said nothing at v1.
The bump is purely additive — no v1 field changes meaning, and keys are DXF
handles, untouched — so there is no data migration.
"""

from __future__ import annotations

import math
import re
from typing import Any

ARTIFACT = "vextrus.entitygraph"
VERSION = 2

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

# The space marker (§7, ADR-0009). Model space is the reserved token `model`;
# a paper layout is its DXF name behind the `paper:` prefix — `:` cannot occur
# in a DXF layout name, so the two can never collide, and the token stays one
# compact string per entity (the §2 `scheme:key` idiom).
SPACE_MODEL = "model"
PAPER_PREFIX = "paper:"


def paper_space(layout_name: str) -> str:
    """The space marker naming a paper layout."""
    return f"{PAPER_PREFIX}{layout_name}"


def layout_of(space: str) -> str | None:
    """The layout a space marker names, or None for model space."""
    return space[len(PAPER_PREFIX) :] if space.startswith(PAPER_PREFIX) else None


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
        # Robust extents over model space (§4). No entities, no extents: null
        # is the honest reading — never a zero-size box at the origin.
        "extents": {"bbox": None, "rejected": 0},
        "layouts": {"paper": [], "dropped_contentless": 0},
        "counters": {
            "original": 0,
            "derived": 0,
            "explode_truncated": False,
            "flatten_capped": 0,
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

    extents = doc.get("extents")
    if not isinstance(extents, dict):
        raise ArtifactError("extents must be an object")
    if extents.get("bbox") is not None and not _is_bbox(extents.get("bbox")):
        raise ArtifactError("extents.bbox must be null or [minx, miny, maxx, maxy]")
    if not _is_count(extents.get("rejected")):
        raise ArtifactError("extents.rejected must be a non-negative int")

    layouts = doc.get("layouts")
    if not isinstance(layouts, dict):
        raise ArtifactError("layouts must be an object")
    if not _is_count(layouts.get("dropped_contentless")):
        raise ArtifactError("layouts.dropped_contentless must be a non-negative int")
    paper = layouts.get("paper")
    if not isinstance(paper, list):
        raise ArtifactError("layouts.paper must be a list")
    shipped: set[str] = set()
    for i, entry in enumerate(paper):
        if not isinstance(entry, dict):
            raise ArtifactError(f"layouts.paper[{i}] must be an object")
        name = entry.get("name")
        if not (isinstance(name, str) and name):
            raise ArtifactError(f"layouts.paper[{i}].name must be the layout's DXF name")
        if ":" in name:  # the prefix delimiter; a DXF layout name cannot carry it
            raise ArtifactError(f"layouts.paper[{i}].name must not contain ':'")
        if name in shipped:
            raise ArtifactError(f"layouts.paper[{i}].name {name!r} is listed twice")
        shipped.add(name)
        if entry.get("bbox") is not None and not _is_bbox(entry.get("bbox")):
            raise ArtifactError(f"layouts.paper[{i}].bbox must be null or [minx, miny, maxx, maxy]")

    counters = doc.get("counters")
    if not isinstance(counters, dict):
        raise ArtifactError("counters must be an object")
    for key in ("original", "derived"):
        value = counters.get(key)
        if not (isinstance(value, int) and not isinstance(value, bool) and value >= 0):
            raise ArtifactError(f"counters.{key} must be a non-negative int")
    if not isinstance(counters.get("explode_truncated"), bool):
        raise ArtifactError("counters.explode_truncated must be a bool")
    if not _is_count(counters.get("flatten_capped")):
        raise ArtifactError("counters.flatten_capped must be a non-negative int")
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
        # An entity in a layout the inventory dropped would make
        # `dropped_contentless` a lie; the two readings must agree.
        layout = layout_of(entity["space"])
        if layout is not None and layout not in shipped:
            raise ArtifactError(
                f"entities[{i}].space names layout {layout!r}, absent from layouts.paper"
            )
    return doc


def _is_num(v: Any) -> bool:
    # Non-finite geometry is malformed input and refuses here by name — bare
    # Infinity/NaN also serializes as JSON no strict parser accepts.
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v)


def _is_pt(v: Any) -> bool:
    return isinstance(v, list) and len(v) == 2 and all(_is_num(c) for c in v)


def _is_bbox(v: Any) -> bool:
    return (
        isinstance(v, list)
        and len(v) == 4
        and all(_is_num(c) for c in v)
        and v[0] <= v[2]
        and v[1] <= v[3]
    )


def _is_count(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


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
    space = e.get("space")
    _chk(
        space == SPACE_MODEL or (isinstance(space, str) and space.startswith(PAPER_PREFIX)),
        f"{where}.space must be {SPACE_MODEL!r} or {PAPER_PREFIX}<layout name>",
    )
    _chk(space == SPACE_MODEL or len(space) > len(PAPER_PREFIX), f"{where}.space names no layout")
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
