# The work-item catalogue — the coverage denominator without a book

[Ticket](../tickets/01-the-work-item-catalogue.md) · ruled 2026-08-13

The enumeration is `work_item_catalogue` — **platform-owned, code-derived, at quantity-kind
grain, primary-keyed on the kind value** (the codebase's first non-tenant table). The **whole
catalogue is every project's denominator**, narrowed only by an attributed act (§6 bans a
coverage percentage, so over-breadth costs reading length while under-breadth hides the money).
`RATE_MODIFIER` is a **pricing role in `book/`**, never a kind — it names no trade, and a
modifier inherits rather than originates. `book/` joins on `kind` with unit as the dimension
veto: no re-key. Safe only because **scope rows key `(class × kind)`** — at class grain a beam's
unmeasured formwork hides behind its concrete line. Amends `measurement-rules.md` §4 and
`quantity-contract.md` §2/§6/§7. Rejected: SoR-item grain (needs editions to be coherent — it
*is* `book/`) and per-tenant copy-down (§8's precondition is human authorship, which is absent,
and a tenant-scoped key breaks the national book's join).
