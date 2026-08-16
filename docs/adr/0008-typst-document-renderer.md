# ADR-0008 — The document renderer is Typst, pinned, as a subprocess

**Date:** 2026-08-16 · **Status:** accepted · **Supersedes:** nothing.
**Evidence:** `docs/research/pdf-bengali-2026-08.md` (2026-08-16 — primary sources cited by URL,
and every candidate marked **[M]** installed on this machine, rendered, and read back
glyph-by-glyph). Resolves decision ticket #133 on the takeoff map #128.

## Context

`quantity-contract.md` §6 requires the bill and its Certificate of Measured Coverage to bind into
**one server-generated PDF** — a browser print cannot guarantee the certificate travels — and
`docs/CONTEXT.md` requires every client-facing string in **Bangla and English**. Bengali is a
complex script: conjuncts, reph, pre-base matras and ya-phala are produced by an OpenType shaping
engine, and a toolchain without one emits broken clusters **silently**, from a font that visibly
"has all the features". `cad-ingestion.md` §1 bans AGPL PDF libraries in shipped code.

Shaping turned out not to be the discriminator — three permissive toolchains were measured
rendering Bengali correctly. The discriminator is that **correct rendering and correct extraction
are different properties**: shaping merges and reorders clusters, and a `/ToUnicode` CMap alone
cannot describe that merge back to Unicode, so the extracted text comes out in visual order with
holes in it. Of the candidates measured, one emits `/ActualText` and round-trips exactly.
`quantity-contract.md` §6's amendment of 2026-08-16 makes that round-trip a requirement, so it
selects the toolchain.

## Decision

- **Typst is the document renderer**, invoked as a **subprocess with a temp dir** — the shape
  ADR-0001 already sanctions for LibreDWG, and it consumes none of that ADR's "GPL as subprocess"
  allowance because Typst is **Apache-2.0** outright. One statically linked binary (54 MB
  unpacked, measured), no system libraries, no Python, no browser.
- **The binary is pinned by version and hash, and the pin is a sanity number** in the sense of
  `cad-ingestion.md` §12: `/ActualText` arrives only at Typst ≥ 0.14 (the krilla backend, PR
  #5420), and the measured version is **0.15.1**. A renderer whose version moves is re-measured
  against the gate below before it lands.
- **The Node binding is rejected for now.** `@myriaddreamin/typst-ts-node-compiler` patches every
  typst crate to a fork and its embedded upstream version could not be established; since the
  whole ruling rests on a behaviour that begins at 0.14, an unestablished version cannot inherit
  it. *Assumption named:* the process boundary costs less than that uncertainty. Revisit by
  establishing the embedded version, never by assuming it.
- **Strings cross the boundary as data, never as interpolated markup.** The document stage passes
  the bill and certificate as a structured payload; the template is Typst markup that reads it. A
  formatter with a stated locale owns lakh/crore grouping and every rendered number
  (`toLocaleString` is a lint error); a template that concatenates strings would put document
  formatting back where the register can reach it.
- **The mechanical gate is glyph-level, and needs two instruments, not one.** Cluster-count and
  matra-ordering assertions over a committed font pinned by hash — `কি` (matra), `ক্ষ` (conjunct),
  `র্ক` (reph), `ক্য` (ya-phala), `ন্ত্র` (stacked) — because counting alone is blind to ordering
  and ordering alone is blind to counting. Measured and recorded so nobody re-derives it: an
  **exact rendered-image hash is theatre**, and a **text-extraction round-trip on its own is
  inverted** — it passes the visibly broken document and fails the correct one. The round-trip
  therefore tests §6's searchability requirement, and only that; the shaping gate is separate.
  `pypdfium2` honours `/ActualText` and exposes no glyph identity; `pdfjs-dist` is the reverse.
  Each is the wrong instrument for the other's job.
- **The font ships with the document, pinned by hash, with `OFL.txt` beside it** (OFL clause 2),
  under a **coverage assertion over the document's full character set**. The two official builds
  of Noto Sans Bengali are not interchangeable: the variable `google/fonts` build carries Latin,
  ASCII digits, `৳` and the em dash (730 glyphs, measured); the static `notofonts` build carries
  no Latin and no ASCII digits (418 glyphs) and drops them — on a BOQ face that means English item
  descriptions and the digits of a rate vanish while the Bengali stays perfect.

## Alternatives rejected, by name

| candidate | licence | why not |
|---|---|---|
| **pdfkit + fontkit** (Node, in-process) | MIT | shapes correctly, but extraction returns **visual order**; `text()` ignores its own `actual` option, so `/ActualText` means hand-writing the tagged-PDF `doc.struct` API |
| **ReportLab 5 + uharfbuzz** | BSD-3 | shapes correctly; conjuncts extract as **private-use codepoints** |
| **WeasyPrint** | BSD-3 (Pango/HarfBuzz via `dlopen`) | no `/ActualText`; adds an LGPL posture question this ruling avoids entirely |
| **headless Chromium** | Apache-2.0/BSD-3 | the reference renderer and the heaviest dependency (~280 MB); §6's "a browser print cannot guarantee the certificate travels" reads as a definition to one eye and a reason to the other — not a parenthesis to litigate for a dependency this size |
| **fpdf2** | **LGPL-3.0-only** | pure-Python, so `import` is the only linking mechanism — a harder copyleft argument than `dlopen`, not an easier one |
| **`@vivliostyle/cli`** | **AGPL-3.0** | banned outright by `cad-ingestion.md` §1 |
| **Apache FOP** | Apache-2.0 | its own complex-scripts table reads *Bengali: support none, tested none* |
| **pdf-lib** | MIT | **throws** on Bengali on Node 24, and discards GPOS by design |

## Consequences

- A **third runtime artifact** enters the repo's contract, after Node and `cad/`'s Python. It is
  pinned, subprocess-only, and stateless, so it is verified the way LibreDWG is — by a fixture that
  fails when the pin moves.
- **The licence test ADR-0001 promised now comes due.** That ADR says AGPL PDF libraries are
  "enforced by a test when a PDF lane lands"; a document renderer *is* a PDF lane, and the test
  does not exist today (measured: no reference to `fitz`, `mutool`, `pymupdf` or AGPL anywhere in
  the tree). Note that `eslint.config.js` ignores `cad/**`, so the Python half of that assertion is
  a pytest, not a lint rule.
- **The bill template is written in Typst markup** — a language nobody in this repo writes today.
  For a fixed A4 document with a table and a certificate block, a native paged model is worth more
  than familiarity; the cost is real and is paid deliberately.
- **Watch-item:** `rustybuzz`, Typst's shaping engine, is archived upstream in favour of HarfRust,
  and Typst's migration PR is open. The port is finished and the successor is by the same
  organisation, so the practical risk is low — but the shaping gate above is what would catch a
  regression, and that is why it is not optional.
- What is given up: an in-process Node renderer, and with it the option of writing the document in
  React alongside the app's other views.
