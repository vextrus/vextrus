# Vector PDF to EntityGraph

[Ticket](../tickets/06-vector-pdf-to-entitygraph.md) · ruled 2026-08-13 · findings in [`docs/research/vector-pdf-to-entitygraph.md`](../../../docs/research/vector-pdf-to-entitygraph.md)

The lane is admitted at **two entity types of ten** — LWPOLYLINE + TEXT, the other eight named
absences. Extractor is **pikepdf** (measured: PDFium cannot name an object's layer); pypdfium2
stays for rendering. Measured on real sheets: text is often outlined (0 chars on 3 of 3 CAD
plots), OCGs are usually flattened away (0 of 5), `/Measure` never appears (0 of 14), and the
scale ladder loses two rungs, not one. Rejected pypdfium2-alone and pdfplumber. HABS/HAER
corrected out of this lane — it is raster, ticket 07's material. **This ruling and 02 landed the
same day and disagree about who decomposes a PDF page** — ticket 24 settles it.
