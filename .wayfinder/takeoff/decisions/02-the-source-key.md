# The source key — provenance when there is no DXF handle

[Ticket](../tickets/02-the-source-key.md) · ruled 2026-08-13

`h` generalises to one opaque `scheme:key` token over a closed vocabulary split by *minting
extractor* — `DXF_HANDLE` · `PDF_OBJECT` · `RASTER_TRACE` — riding per key (the hybrid page mints
two). The atom is the EntityGraph original entity, defined by the extractor alone; PDF keys are a
digest of page index + type + resolved page-space geometry quantized to 0.001 pt, with Form
XObjects taking §3's INSERT law verbatim. Keys are scoped to `(file bytes, extractor identity)` —
no cross-file, no cross-version survival; a vectorizer upgrade is a declared re-ingest and §5
re-presents the rows. Collisions **collapse and are counted per type**, never disambiguated by an
ordinal, because content-derivation's real warrant is **self-authentication** (ticket 17's
verifier can recompute a digest; it cannot check a counter). Storage is a prefix with no data
migration — unprefixed reads as `DXF_HANDLE`, since evidence is append-only by grant. Amendment
landed in `cad-ingestion.md` §2–§3 and `identity.md` §3/§5.
