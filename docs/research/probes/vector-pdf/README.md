# Vector-PDF probe

The measurements in `docs/research/vector-pdf-to-entitygraph.md` came from these scripts. They
are **probes, not pipeline code** — nothing here ships, nothing here is imported by `cad/`, and
`pnpm verify` does not run them.

The corpus is deliberately **not committed**: `docs/research/drawing-corpora.md` rules the
Wikimedia and agency files scratch-only. `fetch.sh` re-downloads them into `.data/pdfprobe/`.

Run it through `uv run --with`, which keeps the environment in uv's own cache. **Do not create a
venv anywhere inside the repo** — `.data/` is gitignored but eslint still walks it, and a
`matplotlib` install there fails `pnpm verify` on 22 lint errors in vendored JS.

```sh
P="uv run --with pikepdf --with pdfplumber --with pypdfium2 --with ezdxf --with matplotlib \
   python docs/research/probes/vector-pdf/probe.py"

$P roundtrip                       # no network needed

mkdir -p .data/pdfprobe && (cd .data/pdfprobe && bash ../../docs/research/probes/vector-pdf/fetch.sh)
$P census .data/pdfprobe/*.pdf
$P layers .data/pdfprobe/level11.pdf
$P pdfium .data/pdfprobe/level11.pdf
```

`roundtrip` is the one that needs no network: it plots the committed
`cad/tests/fixtures/structural-r1.dxf` and `-r2.dxf` to vector PDFs, censuses them against the
committed EntityGraph, and measures content-stream ordinal stability across the revision pair.
