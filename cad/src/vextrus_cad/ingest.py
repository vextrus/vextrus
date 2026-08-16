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
  at fixed tolerance under a point cap (§4).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf import path as ezpath
from ezdxf.colors import aci2rgb, int2rgb

from .entitygraph import ENTITY_TYPES, empty_artifact, validate

EXPLODE_DEPTH = 4
DERIVED_BUDGET = 50_000
# Paint fidelity only, never measurement: fixed flattening tolerance in native
# drawing units with a per-entity point cap (§4).
FLATTEN_TOLERANCE = 0.05
MAX_PATH_POINTS = 256

_EXPANDABLE = frozenset({"INSERT", "DIMENSION"})
_PATHLIKE = frozenset({"LWPOLYLINE", "POLYLINE", "SOLID"})


@dataclass
class _Fidelity:
    original: int = 0
    derived: int = 0
    truncated: bool = False
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


def _record(
    entity: Any, dxftype: str, *, h: str | None, src: str | None, color: str
) -> dict[str, Any] | None:
    """Build the entity record; None means degenerate (unrepresentable) —
    the caller counts it, never drops it silently."""
    rec: dict[str, Any] = {
        "h": h,
        "t": dxftype,
        "layer": entity.dxf.layer,
        "color": color,
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
        rec["text"], rec["p"] = entity.plain_text(), _xy(d.insert)
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
            _explode(ve, doc, src, depth + 1, layer, color, out, fid, max_depth, budget)
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
        rec = _record(ve, dxftype, h=None, src=src, color=color)
        if rec is None:
            _bump(fid.unsupported, f"{dxftype}(DEGENERATE)")
            continue
        out.append(rec)
        fid.derived += 1


def extract(
    doc: ezdxf.document.Drawing,
    *,
    filename: str,
    sha256: str,
    explode_depth: int = EXPLODE_DEPTH,
    derived_budget: int = DERIVED_BUDGET,
) -> dict[str, Any]:
    """Model-space entities → EntityGraph artifact. Views and extents are
    later tickets; this stage is entities and honest counters only."""
    artifact = empty_artifact(filename, sha256, doc.header.get("$INSUNITS", None))
    fid = _Fidelity()
    entities: list[dict[str, Any]] = []
    for entity in doc.modelspace():
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
        rec = _record(entity, dxftype, h=handle, src=None, color=color)
        if rec is None:
            _bump(fid.unsupported, f"{dxftype}(DEGENERATE)")
            continue
        entities.append(rec)
        fid.original += 1
        if dxftype in _EXPANDABLE:
            _explode(
                entity,
                doc,
                handle,
                1,
                entity.dxf.layer,
                color,
                entities,
                fid,
                explode_depth,
                derived_budget,
            )
    artifact["counters"] = {
        "original": fid.original,
        "derived": fid.derived,
        "explode_truncated": fid.truncated,
        "lost_by_type": dict(sorted(fid.lost.items())),
        "unsupported_by_type": dict(sorted(fid.unsupported.items())),
    }
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
