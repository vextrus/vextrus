"""DXF → EntityGraph extraction (cad-ingestion.md §2–§4).

Laws implemented here:
- The DXF handle is THE provenance key; every original entity carries one (§2).
- Coordinates stay in native drawing units; $INSUNITS is reported, never
  interpreted — unmapped codes flag, they never read as unitless (§2).
- The extractor invariant (§3): INSERTs and DIMENSIONs explode to world
  coordinates for *rendering only*; every synthesized entity carries `src`
  (the originating model-space entity's handle) and `src is None` is the
  original-entity predicate. Depth and budget caps that trip say so:
  `explode_truncated` plus per-type loss counters, never one global scalar.
- Colour resolves server-side: true_color → explicit ACI → BYLAYER (layer "0"
  inside a block takes the insert's layer) → BYBLOCK (§4).
- Text carries world height; closed paths carry shoelace area; curves flatten
  at fixed tolerance under a point cap (§4), and a tripped cap is counted
  (`flatten_capped`) — at v1 it said nothing.
- Version 2 (ADR-0009): every entity carries its space marker (model space or
  the named paper layout); paper layouts are walked exactly as model space and
  each shipped layout carries its bbox **and its own counters**, with layouts
  that held no entity at all counted as dropped rather than silently absent;
  model-space extents are robust, with the count of entities §4's
  inter-percentile window rejected.
- **The envelope's counters are model space's, as at v1.** Every real sheet
  carries VIEWPORT entities the vocabulary does not admit; summing them into
  `unsupported_by_type` would change what a v1 field means and hand the scope
  register an `ENTITY_TYPE_UNHANDLED` for sheet furniture nobody measures. A
  layout's fidelity is named where its space is named, in the inventory.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf import path as ezpath
from ezdxf.colors import aci2rgb, int2rgb
from ezdxf.tools.text import fast_plain_mtext

from .entitygraph import (
    ENTITY_TYPES,
    SPACE_MODEL,
    empty_artifact,
    empty_counters,
    paper_space,
    validate,
)

EXPLODE_DEPTH = 4
DERIVED_BUDGET = 50_000
# Paint fidelity only, never measurement: fixed flattening tolerance in native
# drawing units with a per-entity point cap (§4).
FLATTEN_TOLERANCE = 0.05
MAX_PATH_POINTS = 256

# Robust extents (§4): reject an entity whose bbox centre falls outside the
# 2nd–98th inter-percentile window of all centres, widened by 25% of its own
# span on each side. Percentiles are nearest-rank — no interpolation, so the
# window is a coordinate the drawing actually contains and re-derivation is
# exact. When nothing is rejected the result is the naive extents.
EXTENTS_LOW_PERCENTILE = 2.0
EXTENTS_HIGH_PERCENTILE = 98.0
EXTENTS_WINDOW_MARGIN = 0.25

_EXPANDABLE = frozenset({"INSERT", "DIMENSION"})
_PATHLIKE = frozenset({"LWPOLYLINE", "POLYLINE", "SOLID"})


@dataclass
class _Fidelity:
    original: int = 0
    derived: int = 0
    truncated: bool = False
    flatten_capped: int = 0
    lost: dict[str, int] = field(default_factory=dict)
    unsupported: dict[str, int] = field(default_factory=dict)


def _bump(counter: dict[str, int], dxftype: str) -> None:
    counter[dxftype] = counter.get(dxftype, 0) + 1


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def _safe_aci(aci: int) -> int:
    return aci if 1 <= aci <= 255 else 7


def _layer_hex(doc: ezdxf.document.Drawing, name: str) -> str:
    if not doc.layers.has_entry(name):
        return _hex(aci2rgb(7))
    layer = doc.layers.get(name)
    rgb = layer.rgb
    if rgb is not None:
        return _hex(rgb)
    # A negative colour means the layer is off — the colour itself is |aci|.
    return _hex(aci2rgb(_safe_aci(abs(layer.color))))


def _resolve_color(
    entity: Any,
    doc: ezdxf.document.Drawing,
    parent_layer: str | None,
    parent_color: str | None,
) -> str:
    if entity.dxf.hasattr("true_color"):
        return _hex(int2rgb(entity.dxf.true_color))
    aci = entity.dxf.get("color", 256)
    if aci == 256:  # BYLAYER; layer "0" inside a block takes the insert's layer
        name = entity.dxf.layer
        if parent_layer is not None and name == "0":
            name = parent_layer
        return _layer_hex(doc, name)
    if aci == 0:  # BYBLOCK
        return parent_color if parent_color is not None else _hex(aci2rgb(7))
    return _hex(aci2rgb(_safe_aci(abs(aci))))


def _flatten(entity: Any) -> list[list[float]]:
    return [
        [float(v.x), float(v.y)] for v in ezpath.make_path(entity).flattening(FLATTEN_TOLERANCE)
    ]


def _decimate(pts: list[list[float]]) -> list[list[float]]:
    if len(pts) <= MAX_PATH_POINTS:
        return pts
    stride = -(-len(pts) // MAX_PATH_POINTS)  # ceil division
    kept = pts[::stride]
    if kept[-1] != pts[-1]:
        kept.append(pts[-1])
    return kept


def _unsupported_variant(entity: Any, dxftype: str) -> str | None:
    """A supported type name whose variant we cannot represent — counted under
    a subtype key, never crashed on (make_path raises TypeError for meshes)."""
    if dxftype == "POLYLINE":
        if entity.is_polygon_mesh:
            return "POLYLINE(POLYMESH)"
        if entity.is_poly_face_mesh:
            return "POLYLINE(POLYFACE)"
    return None


def _shoelace(pts: list[list[float]]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1], strict=True):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def _is_closed(entity: Any, dxftype: str) -> bool:
    if dxftype == "LWPOLYLINE":
        return bool(entity.closed)
    if dxftype == "POLYLINE":
        return bool(entity.is_closed)
    return True  # SOLID


def _xy(v: Any) -> list[float]:
    return [float(v[0]), float(v[1])]


# Text crosses the seam RAW (ADR-0009, §6's amendment): `cad/` never applies
# AutoCAD's escapes — %%C→Ø, %%D→°, %%P→± are §6's job, in the app, grading on
# top of raw truth as §11's raw-retention law requires. ezdxf's MTEXT plain-text
# extraction applies them on the way out, so they are shielded behind a sentinel
# the source string does not contain and restored after; MTEXT's own inline
# codes (\P, font and grouping runs) still resolve, which is what "plain" means.
_AUTOCAD_ESCAPE = "%%"
_SHIELD = "\ue000"  # private use area


def _raw_plain_text(entity: Any) -> str:
    raw: str = entity.text
    if _AUTOCAD_ESCAPE not in raw:
        return fast_plain_mtext(raw, split=False)
    shield = _SHIELD
    while shield in raw:  # a sentinel the string carries would not round-trip
        shield += _SHIELD
    plain = fast_plain_mtext(raw.replace(_AUTOCAD_ESCAPE, shield), split=False)
    return plain.replace(shield, _AUTOCAD_ESCAPE)


# ── Extents (§4). Bounding boxes are taken over the *emitted record*, never the
# ezdxf entity, so the app can re-derive this extents record from the artifact
# it was shipped — the artifact is the whole contract (ADR-0009).

Box = tuple[float, float, float, float]


def _arc_bbox(c: list[float], r: float, a1: float, a2: float) -> Box:
    """An arc bounds its two endpoints plus every axis crossing its sweep
    covers — the full circle's box would over-report three quadrants."""
    cx, cy = c[0], c[1]
    a1, a2 = a1 % 360.0, a2 % 360.0
    # DXF arcs run counter-clockwise from a1 to a2; coincident angles are the
    # full circle every reader paints, never a zero-length arc.
    sweep = (a2 - a1) % 360.0 or 360.0
    xs = [cx + r * math.cos(math.radians(a)) for a in (a1, a2)]
    ys = [cy + r * math.sin(math.radians(a)) for a in (a1, a2)]
    for quadrant in range(4):
        if (quadrant * 90.0 - a1) % 360.0 <= sweep:
            xs.append(cx + r * math.cos(math.radians(quadrant * 90.0)))
            ys.append(cy + r * math.sin(math.radians(quadrant * 90.0)))
    return (min(xs), min(ys), max(xs), max(ys))


def _bbox_of(rec: dict[str, Any]) -> Box | None:
    """The record's own bounds, or None where it carries no geometry."""
    t = rec["t"]
    if t == "ARC":
        return _arc_bbox(rec["c"], rec["r"], rec["a1"], rec["a2"])
    if t == "CIRCLE":
        (cx, cy), r = rec["c"], rec["r"]
        return (cx - r, cy - r, cx + r, cy + r)
    if t == "LINE":
        pts = [rec["p1"], rec["p2"]]
    elif t in _PATHLIKE:
        pts = rec["pts"]
    elif t in ("TEXT", "MTEXT", "INSERT"):
        # The anchor alone. A string's painted width is a font metric this
        # extractor does not resolve, and an assumed one would be a guess; an
        # INSERT's paint arrives as derived entities carrying their own bounds.
        pts = [rec["p"]]
    else:
        return None  # DIMENSION: provenance only, its geometry is derived.
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def _union(boxes: list[Box]) -> Box:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def _percentile(values: list[float], q: float) -> float:
    """Nearest-rank: the returned bound is a coordinate the drawing contains,
    so re-derivation is exact and no interpolation invents a number."""
    idx = math.ceil(q / 100.0 * len(values)) - 1
    return values[min(len(values) - 1, max(0, idx))]


def _naive_extents(recs: list[dict[str, Any]]) -> Box | None:
    boxes = [b for b in (_bbox_of(r) for r in recs) if b is not None]
    return _union(boxes) if boxes else None


def _robust_extents(recs: list[dict[str, Any]]) -> tuple[Box | None, int]:
    """§4's stray-entity rejection: an entity whose bbox centre falls outside
    the 2nd-98th inter-percentile window of all centres (widened by 25% of the
    window's own span on each side) is xref junk and does not set the extents.
    When nothing is rejected the result is the naive extents exactly."""
    boxes = [b for r in recs if (b := _bbox_of(r)) is not None]
    if not boxes:
        return None, 0
    centres = [((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0) for b in boxes]
    window: list[tuple[float, float]] = []
    for axis in (0, 1):
        values = sorted(c[axis] for c in centres)
        low = _percentile(values, EXTENTS_LOW_PERCENTILE)
        high = _percentile(values, EXTENTS_HIGH_PERCENTILE)
        margin = (high - low) * EXTENTS_WINDOW_MARGIN
        window.append((low - margin, high + margin))
    kept = [
        box
        for box, centre in zip(boxes, centres, strict=True)
        if all(window[a][0] <= centre[a] <= window[a][1] for a in (0, 1))
    ]
    if not kept:
        # A window that rejects every entity has rejected nothing meaningful;
        # report the naive extents and say plainly that nothing was rejected.
        return _union(boxes), 0
    return _union(kept), len(boxes) - len(kept)


def _bbox_json(box: Box | None) -> list[float] | None:
    return None if box is None else [box[0], box[1], box[2], box[3]]


def _record(
    entity: Any,
    dxftype: str,
    *,
    h: str | None,
    src: str | None,
    color: str,
    space: str,
    fid: _Fidelity,
) -> dict[str, Any] | None:
    """Build the entity record; None means degenerate (unrepresentable) —
    the caller counts it, never drops it silently."""
    rec: dict[str, Any] = {
        "h": h,
        "t": dxftype,
        "layer": entity.dxf.layer,
        "color": color,
        "space": space,
        "src": src,
    }
    d = entity.dxf
    if dxftype == "LINE":
        rec["p1"], rec["p2"] = _xy(d.start), _xy(d.end)
    elif dxftype in _PATHLIKE:
        pts = _flatten(entity)
        if len(pts) < 2:
            return None
        closed = _is_closed(entity, dxftype)
        if len(pts) > MAX_PATH_POINTS:
            # The cap is paint fidelity, but a loss nobody counted is the
            # silence §3 forbids — unlike explode_truncated this said nothing
            # at v1 (ADR-0009).
            fid.flatten_capped += 1
        rec["pts"], rec["closed"] = _decimate(pts), closed
        # Area from the full flattening — the point cap is paint fidelity and
        # must never leak into a carried figure.
        rec["area"] = _shoelace(pts) if closed else None
    elif dxftype == "CIRCLE":
        rec["c"], rec["r"] = _xy(d.center), float(d.radius)
    elif dxftype == "ARC":
        rec["c"], rec["r"] = _xy(d.center), float(d.radius)
        rec["a1"], rec["a2"] = float(d.start_angle), float(d.end_angle)
    elif dxftype == "TEXT":
        # get_placement resolves the effective anchor — for non-left
        # justification the raw group-10 insert is not meaningful.
        rec["text"], rec["p"] = d.text, _xy(entity.get_placement()[1])
        rec["height"], rec["rot"] = float(d.height), float(d.get("rotation", 0.0))
    elif dxftype == "MTEXT":
        # get_rotation: transformed MTEXT stores text_direction, and the raw
        # rotation attribute silently reads 0.
        rec["text"], rec["p"] = _raw_plain_text(entity), _xy(d.insert)
        rec["height"], rec["rot"] = float(d.char_height), float(entity.get_rotation())
    elif dxftype == "INSERT":
        rec["name"], rec["p"] = d.name, _xy(d.insert)
        # Block attributes (grid-bubble letters, callout tags) collect
        # separately off the INSERT — never into the derived stream (§3).
        rec["attrs"] = [
            {
                "tag": a.dxf.tag,
                "text": a.dxf.text,
                "p": _xy(a.get_placement()[1]),
                "height": float(a.dxf.height),
            }
            for a in entity.attribs
        ]
    # DIMENSION: provenance fields only; its rendered geometry (measurement
    # text included) arrives as derived entities citing this handle.
    return rec


def _explode(
    source: Any,
    doc: ezdxf.document.Drawing,
    src: str,
    depth: int,
    parent_layer: str,
    parent_color: str,
    out: list[dict[str, Any]],
    fid: _Fidelity,
    max_depth: int,
    budget: int,
    space: str,
) -> None:
    for ve in source.virtual_entities():
        dxftype = ve.dxftype()
        if dxftype in _EXPANDABLE:
            # Nested reference: recurse, never emit — paint comes from its
            # leaves; provenance stays the top original's handle (virtual
            # entities carry no handles of their own).
            if depth >= max_depth:
                fid.truncated = True
                _bump(fid.lost, dxftype)
                continue
            layer = ve.dxf.layer if ve.dxf.layer != "0" else parent_layer
            color = _resolve_color(ve, doc, parent_layer, parent_color)
            _explode(ve, doc, src, depth + 1, layer, color, out, fid, max_depth, budget, space)
            continue
        if dxftype not in ENTITY_TYPES:
            _bump(fid.unsupported, dxftype)
            continue
        variant = _unsupported_variant(ve, dxftype)
        if variant is not None:
            _bump(fid.unsupported, variant)
            continue
        if fid.derived >= budget:
            fid.truncated = True
            _bump(fid.lost, dxftype)
            continue
        color = _resolve_color(ve, doc, parent_layer, parent_color)
        rec = _record(ve, dxftype, h=None, src=src, color=color, space=space, fid=fid)
        if rec is None:
            _bump(fid.unsupported, f"{dxftype}(DEGENERATE)")
            continue
        out.append(rec)
        fid.derived += 1


def _walk(
    source: Any,
    doc: ezdxf.document.Drawing,
    *,
    space: str,
    fid: _Fidelity,
    max_depth: int,
    budget: int,
) -> tuple[list[dict[str, Any]], int]:
    """One space's entities — originals and the paint they explode into, each
    marked with the space it was drawn in (ADR-0009). Model space and a paper
    layout take the identical walk: the seam knows one geometry vocabulary.

    Returns the records **and the number of entities the space held**. The two
    differ whenever a space holds only things the vocabulary cannot represent,
    and the caller must tell those apart: a layout that held nothing is
    content-less, a layout whose content we could not represent is not, and
    collapsing them would name a loss falsely (§3)."""
    out: list[dict[str, Any]] = []
    held = 0
    for entity in source:
        held += 1
        dxftype = entity.dxftype()
        if dxftype not in ENTITY_TYPES:
            _bump(fid.unsupported, dxftype)
            continue
        variant = _unsupported_variant(entity, dxftype)
        if variant is not None:
            _bump(fid.unsupported, variant)
            continue
        color = _resolve_color(entity, doc, None, None)
        handle = str(entity.dxf.handle)
        rec = _record(entity, dxftype, h=handle, src=None, color=color, space=space, fid=fid)
        if rec is None:
            _bump(fid.unsupported, f"{dxftype}(DEGENERATE)")
            continue
        out.append(rec)
        fid.original += 1
        if dxftype in _EXPANDABLE:
            _explode(
                entity,
                doc,
                handle,
                1,
                entity.dxf.layer,
                color,
                out,
                fid,
                max_depth,
                budget,
                space,
            )
    return out, held


def _counters_json(fid: _Fidelity) -> dict[str, Any]:
    """One space's fidelity. Built from `empty_counters()` so the envelope's
    block and a layout's block are one shape by construction, not by habit."""
    counters = empty_counters()
    counters.update(
        original=fid.original,
        derived=fid.derived,
        explode_truncated=fid.truncated,
        flatten_capped=fid.flatten_capped,
        lost_by_type=dict(sorted(fid.lost.items())),
        unsupported_by_type=dict(sorted(fid.unsupported.items())),
    )
    return counters


def extract(
    doc: ezdxf.document.Drawing,
    *,
    filename: str,
    sha256: str,
    explode_depth: int = EXPLODE_DEPTH,
    derived_budget: int = DERIVED_BUDGET,
) -> dict[str, Any]:
    """The drawing's spaces → EntityGraph artifact: model space, then every
    paper layout in tab order, with honest counters, the robust model-space
    extents and the layout inventory.

    **Each space counts its own fidelity.** The envelope's counters are model
    space's, exactly as they were at v1 — a real sheet's VIEWPORTs, title-block
    xrefs and stray POINTs are the layout's fidelity, named in the layout's own
    inventory entry, and are never summed into a figure the app reads as the
    drawing's. The derived-entity budget is per space for the same reason: a
    drawing with twenty sheets may not starve model space's paint budget, and
    `explode_truncated` on the envelope must keep meaning what it meant at v1."""
    artifact = empty_artifact(filename, sha256, doc.header.get("$INSUNITS", None))
    caps = {"max_depth": explode_depth, "budget": derived_budget}

    model = _Fidelity()
    entities, _ = _walk(doc.modelspace(), doc, space=SPACE_MODEL, fid=model, **caps)
    # §7's law is stated over model space, so the extents that anchor it are
    # model space's — a paper layout's bounds ride in the inventory below.
    extents, rejected = _robust_extents(entities)

    paper: list[dict[str, Any]] = []
    dropped = 0
    modelspace_name = doc.modelspace().name
    for name in doc.layouts.names_in_taborder():
        if name == modelspace_name:
            continue
        fid = _Fidelity()
        records, held = _walk(doc.layout(name), doc, space=paper_space(name), fid=fid, **caps)
        if held == 0:
            # Content-less layouts are dropped, not shipped (§4) — and counted,
            # because a drop nobody counted is the silent loss §3 forbids.
            # `held`, not `records`: a sheet holding only a VIEWPORT or a
            # degenerate path *had* content, and calling that drop
            # content-less would be a false name for it. It ships below with a
            # null bbox and counters naming exactly what could not be
            # represented.
            dropped += 1
            continue
        # Naive bounds: a sheet's content is bounded by the sheet, and §4 gives
        # the stray-entity window to the drawing's extents, not to a layout.
        paper.append(
            {
                "name": name,
                "bbox": _bbox_json(_naive_extents(records)),
                "counters": _counters_json(fid),
            }
        )
        entities.extend(records)

    artifact["extents"] = {"bbox": _bbox_json(extents), "rejected": rejected}
    artifact["layouts"] = {"paper": paper, "dropped_contentless": dropped}
    artifact["counters"] = _counters_json(model)
    artifact["entities"] = entities
    # The producer proves its own emission — an artifact that fails its own
    # contract refuses with the named ArtifactError, it never flows downstream.
    return validate(artifact)


def ingest_file(
    path: str | Path,
    *,
    explode_depth: int = EXPLODE_DEPTH,
    derived_budget: int = DERIVED_BUDGET,
) -> dict[str, Any]:
    p = Path(path)
    sha256 = hashlib.sha256(p.read_bytes()).hexdigest()
    doc = ezdxf.readfile(str(p))
    return extract(
        doc,
        filename=p.name,
        sha256=sha256,
        explode_depth=explode_depth,
        derived_budget=derived_budget,
    )
