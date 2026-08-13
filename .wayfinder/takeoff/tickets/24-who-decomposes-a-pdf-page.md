# Who decomposes a PDF page — pdfium's model, or ours

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

**Two closed tickets disagree, and the disagreement is already in the domain law.** Tickets 02
and 06 were worked in parallel sessions on 2026-08-13 and landed within hours of each other.

- **02 ruled** the `PDF_OBJECT` scheme is minted by **pdfium**, and wrote it into
  `cad-ingestion.md` §2's scheme table — where the `asserted by` column reads **"pdfium's
  decomposition"**, deliberately distinguished from `RASTER_TRACE`'s **"us"**. §3 restates it:
  *"one pdfium page object"*. It names a known consequence: *"a pdfium upgrade re-mints every
  `PDF_OBJECT` key, since its page-object decomposition is the atom."*
- **06 ruled** the vector-PDF extractor is **pikepdf**, on the measurement that PDFium's public
  API cannot name the layer an object sits on — it reports the `/OC` mark and the OCG
  dictionary's key names, but every param types as `FPDF_OBJECT_UNKNOWN` and
  `GetParamStringValue` returns 0. A pikepdf extractor walks the content stream and **we** define
  where one entity ends.

Neither session could see the other. Neither ruling is obviously wrong. But `cad-ingestion.md`
§2's `asserted by` column is not decoration — it records **who warrants the atom**, and it cannot
say "pdfium" while the extractor is pikepdf.

## The decision

1. **Who asserts the PDF atom.** If pikepdf extracts, the honest table entry is `us`, and
   `PDF_OBJECT` moves to the same warranty class as `RASTER_TRACE`. Is that acceptable, or does
   the vector lane's whole claim to be *transcription rather than interpretation* rest on a third
   party asserting the decomposition? Note this bears on ticket 03: if we assert the atom, the
   argument that a vector PDF line is `TRANSCRIBED` and not `INTERPRETED` gets weaker — though
   not obviously wrong, since we would be reading operators the file states explicitly, not
   inferring them.
2. **Or keep pdfium and pay for layers separately.** Ticket 06 explicitly rejected a hybrid —
   pdfium for geometry, pikepdf for `/OCProperties` — on the grounds that two libraries mean two
   geometry models joined on floating-point coordinates. 02's landing raises the price of that
   rejection: re-put it. Is the join actually needed, or can layer membership be resolved once
   per page into a map keyed by something both libraries agree on?
3. **Or drop layers on this lane entirely.** 06 measured **zero OCGs on five of five real
   CAD-plotted sheets** — the PostScript→Distiller path flattens them away. If layers are absent
   in practice anyway, the measurement that forced pikepdf may not be worth what it costs, and
   pdfium plus a named `layer_channel_absent` may be the whole answer. This is the cheapest
   option and it must be put, not assumed away.
4. **What the amendment says either way.** 02's amendment is landed, not draft. Whatever this
   rules, `cad-ingestion.md` §2's table, §3's atom sentence, and 02's named pdfium-upgrade
   consequence are edited **by this ticket's resolution** — superseded in place, never quietly.

## Guardrails

- Findings behind 06's measurement: `docs/research/vector-pdf-to-entitygraph.md` §1; the probe
  reproduces it with `probe.py pdfium <file>`.
- Nothing here reopens 02's *construction* — page index + type + resolved page-space geometry,
  quantized to 0.001 pt, Form XObjects taking §3's INSERT law. That survives any answer below,
  because it is defined over resolved geometry rather than over a library's object list.
- `CLAUDE.md`: a licence test asserts no shipped module imports an AGPL PDF library. pikepdf is
  MPL-2.0 and pypdfium2 is Apache-2.0 OR BSD-3-Clause; both are clean, so licensing does not
  decide this one.
- Whoever takes this: **read both resolutions in full first.** They are long, they are recent,
  and each was defensible on the evidence its session had.
