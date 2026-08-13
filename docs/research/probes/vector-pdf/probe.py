"""Vector-PDF probe — the measurements behind docs/research/vector-pdf-to-entitygraph.md.

Not pipeline code. Three modes:

    census    <files...>   per-file page census: paths, clips, chars, images, OCGs
    layers    <files...>   OCG names + per-layer path/text attribution + world text heights
    pdfium    <files...>   what PDFium's public API does and does not expose
    roundtrip              plot the committed DXF fixtures and diff against their EntityGraph
"""

from __future__ import annotations

import collections
import ctypes
import json
import sys
import time
from pathlib import Path

import pdfplumber
import pikepdf

REPO = Path(__file__).resolve().parents[4]
FIXTURES = REPO / "cad" / "tests" / "fixtures"

IDENT = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
# `n` is deliberately absent: it is the no-op that ends a `W` clip, not a paint.
PAINT = frozenset({"S", "s", "f", "F", "f*", "B", "B*", "b", "b*"})


def mat_mul(a, b):
    a0, a1, a2, a3, a4, a5 = a
    b0, b1, b2, b3, b4, b5 = b
    return (
        a0 * b0 + a1 * b2,
        a0 * b1 + a1 * b3,
        a2 * b0 + a3 * b2,
        a2 * b1 + a3 * b3,
        a4 * b0 + a5 * b2 + b4,
        a4 * b1 + a5 * b3 + b5,
    )


def apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def ocg_names(page) -> dict[str, str]:
    """The page's /Resources/Properties map: /MCn -> OCG name."""
    res = page.get("/Resources", {})
    props = res.get("/Properties", {}) if res else {}
    out = {}
    for k, v in props.items() if props else []:
        try:
            out[str(k)] = str(v.get("/Name", "?"))
        except Exception:  # noqa: BLE001 — a malformed /Properties entry is data, not a crash
            out[str(k)] = "?"
    return out


def walk(page):
    """One content-stream pass: paths in world coords, text with world height, OCG membership."""
    name_of = ocg_names(page)
    ctm, stack, oc_stack = IDENT, [], []
    tm, tfs, cur = IDENT, 0.0, None
    paths, texts, clips = [], [], 0

    for operands, operator in pikepdf.parse_content_stream(page):
        op = str(operator)
        layer = oc_stack[-1] if oc_stack else None
        if op == "q":
            stack.append(ctm)
        elif op == "Q":
            ctm = stack.pop() if stack else IDENT
        elif op == "cm":
            ctm = mat_mul(tuple(float(x) for x in operands), ctm)
        elif op == "BDC":
            key = str(operands[1]) if len(operands) > 1 else ""
            oc_stack.append(
                name_of.get(key, f"?{key}")
                if str(operands[0]) == "/OC"
                else (oc_stack[-1] if oc_stack else None)
            )
        elif op == "EMC":
            if oc_stack:
                oc_stack.pop()
        elif op == "m":
            cur = [apply(ctm, float(operands[0]), float(operands[1]))]
        elif op == "l" and cur is not None:
            cur.append(apply(ctm, float(operands[0]), float(operands[1])))
        elif op == "c" and cur is not None:
            cur.append(apply(ctm, float(operands[4]), float(operands[5])))
        elif op == "re":
            x, y, w, h = (float(v) for v in operands)
            cur = [apply(ctm, x, y), apply(ctm, x + w, y + h)]
        elif op == "Tf":
            tfs = float(operands[1])
        elif op == "Tm":
            tm = tuple(float(x) for x in operands)
        elif op in ("Tj", "TJ", "'", '"'):
            full = mat_mul(tm, ctm)
            texts.append((layer, round(tfs * (full[1] ** 2 + full[3] ** 2) ** 0.5, 2)))
        elif op in PAINT:
            if cur:
                paths.append((layer, tuple((round(a, 2), round(b, 2)) for a, b in cur)))
            cur = None
        elif op == "n":
            clips += 1
            cur = None
    return {"paths": paths, "texts": texts, "clips": clips, "declared": name_of}


def cmd_census(files: list[str]) -> None:
    print(
        f"{'file':16s} {'pages':>5s} {'sheet mm':>13s} {'paths':>7s} "
        f"{'clips':>6s} {'chars':>6s} {'imgs':>5s} {'OCGs':>5s}"
    )
    for f in files:
        with pikepdf.open(f) as pdf:
            mb = [float(x) for x in pdf.pages[0].MediaBox]
            ocgs = len(pdf.Root.OCProperties.get("/OCGs", [])) if "/OCProperties" in pdf.Root else 0
            r = walk(pdf.pages[0])
            n_pages = len(pdf.pages)
        with pdfplumber.open(f) as p:
            chars, imgs = len(p.pages[0].chars), len(p.pages[0].images)
        w, h = (mb[2] - mb[0]) / 72 * 25.4, (mb[3] - mb[1]) / 72 * 25.4
        print(
            f"{Path(f).name:16s} {n_pages:5d} {w:6.0f}x{h:<6.0f} {len(r['paths']):7d} "
            f"{r['clips']:6d} {chars:6d} {imgs:5d} {ocgs:5d}"
        )


def cmd_layers(files: list[str]) -> None:
    for f in files:
        t0 = time.time()
        with pikepdf.open(f) as pdf:
            ocgs = (
                [str(g.get("/Name", "")) for g in pdf.Root.OCProperties.get("/OCGs", [])]
                if "/OCProperties" in pdf.Root
                else []
            )
            print(f"== {f}  declared OCGs: {len(ocgs)} {ocgs[:8]}")
            tot_p = tot_t = 0
            per_layer = collections.Counter()
            heights = collections.Counter()
            for pg in pdf.pages:
                r = walk(pg)
                tot_p += len(r["paths"])
                tot_t += len(r["texts"])
                per_layer.update(layer for layer, _ in r["paths"])
                heights.update(h for _, h in r["texts"])
            print(f"   paths {tot_p}  text runs {tot_t}  per-layer {dict(per_layer)}")
            print(f"   world text heights {heights.most_common(6)}")
        el = time.time() - t0
        print(f"   {el:.2f}s  ({tot_p / el:,.0f} paths/s)")


def cmd_pdfium(files: list[str]) -> None:
    """What PDFium's public API exposes — and the two places it silently misleads."""
    import pypdfium2 as pdfium
    import pypdfium2.raw as pr

    def mark_name(mk):
        buf, n = (ctypes.c_ushort * 256)(), ctypes.c_ulong()
        pr.FPDFPageObjMark_GetName(mk, buf, 512, ctypes.byref(n))
        return bytes(buf).decode("utf-16-le").rstrip("\x00")

    for f in files:
        doc = pdfium.PdfDocument(f)
        pg = doc[0]
        tp = pg.get_textpage()
        heights, raw_sizes = collections.Counter(), collections.Counter()
        for i in range(min(tp.count_chars(), 3000)):
            m = pr.FS_MATRIX()
            ok = pr.FPDFText_GetMatrix(tp.raw, i, ctypes.byref(m))
            fs = pr.FPDFText_GetFontSize(tp.raw, i)
            raw_sizes[round(fs, 2)] += 1
            if ok:
                heights[round(fs * (m.b**2 + m.d**2) ** 0.5, 2)] += 1
        print(f"== {f}")
        print(f"   FPDFText_GetFontSize alone: {raw_sizes.most_common(4)}  <- 1.0 means unusable")
        print(f"   x GetMatrix scale:          {heights.most_common(4)}")

        # Can pdfium name the layer an object sits on? Measured: no.
        for obj in pg.get_objects(max_depth=1):
            if pr.FPDFPageObj_CountMarks(obj.raw):
                mk = pr.FPDFPageObj_GetMark(obj.raw, 0)
                vals = {}
                for key in (b"N", b"T", b"I", b"U"):
                    vb, vn = (ctypes.c_ushort * 512)(), ctypes.c_ulong()
                    ok = pr.FPDFPageObjMark_GetParamStringValue(mk, key, vb, 1024, ctypes.byref(vn))
                    vals[key.decode()] = (
                        bytes(vb)[: vn.value].decode("utf-8", "replace").rstrip("\x00")
                        if ok
                        else None
                    )
                print(f"   mark {mark_name(mk)!r} params -> {vals}   (None = not retrievable)")
                break


def cmd_roundtrip() -> None:
    """Plot the committed fixtures to vector PDF; diff against the committed EntityGraph."""
    import ezdxf
    import matplotlib

    matplotlib.rcParams["pdf.fonttype"] = 42
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

    # Never into the repo root: .data/ is gitignored, the cwd is not.
    outdir = REPO / ".data" / "pdfprobe"
    outdir.mkdir(parents=True, exist_ok=True)

    plotted = {}
    for rev in ("r1", "r2"):
        doc = ezdxf.readfile(FIXTURES / f"structural-{rev}.dxf")
        fig = plt.figure(figsize=(23.4, 16.5))
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_axis_off()
        Frontend(RenderContext(doc), MatplotlibBackend(ax)).draw_layout(
            doc.modelspace(), finalize=True
        )
        out = outdir / f"plot_{rev}.pdf"
        fig.savefig(out)
        plt.close(fig)
        with pikepdf.open(out) as pdf:
            plotted[rev] = walk(pdf.pages[0])

        eg = json.loads((FIXTURES / f"structural-{rev}.entitygraph.json").read_text())
        orig = collections.Counter(e["t"] for e in eg["entities"] if e.get("src") is None)
        print(f"== {rev}: EntityGraph {sum(orig.values())} original {dict(orig)}")
        print(
            f"   plotted PDF: {len(plotted[rev]['paths'])} painted paths, "
            f"{len(plotted[rev]['texts'])} text runs, {plotted[rev]['clips']} clip no-ops"
        )

    # Is content-stream position a lawful provenance key across a revision? Measured: no.
    first_index = {}
    for i, (_, geom) in enumerate(plotted["r1"]["paths"]):
        first_index.setdefault(geom, i)
    same = shifted = absent = 0
    for j, (_, geom) in enumerate(plotted["r2"]["paths"]):
        i = first_index.get(geom)
        if i is None:
            absent += 1
        elif i == j:
            same += 1
        else:
            shifted += 1
    print(
        f"== ordinal stability r1->r2: unchanged geometry at same index {same}, "
        f"at a DIFFERENT index {shifted}, new/absent {absent}"
    )


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == "census":
        cmd_census(args)
    elif mode == "layers":
        cmd_layers(args)
    elif mode == "pdfium":
        cmd_pdfium(args)
    elif mode == "roundtrip":
        cmd_roundtrip()
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
