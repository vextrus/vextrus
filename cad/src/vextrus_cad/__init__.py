"""vextrus-cad: DXF/DWG ingestion as a pure pipeline.

Drawing in, versioned EntityGraph JSON out. Stateless, no DB, no HTTP.
"""

# The extractor identity (cad-ingestion.md §2). A source key is scoped to
# `(file bytes, extractor identity)`, and the ingest record pins that identity
# as **version + parameter-set hash** — so this string must move whenever what
# the extractor emits for the same bytes moves, or two ingests produced by two
# different extractors are indistinguishable in the record that exists to
# distinguish them. The parameter hash covers what the caller supplies
# (`--explode-depth`, `--derived-budget`); every constant baked in here — the
# flatten tolerance and point cap, §4's inter-percentile extents window — rides
# in this version and nowhere else.
#
# 0.1.0 — EntityGraph v2 (ADR-0009): the space marker, paper-space entities,
#         the layout inventory, the robust-extents record, the flatten cap
#         counter, and MTEXT text crossing the seam raw.
# 0.0.0 — EntityGraph v1.
__version__ = "0.1.0"
