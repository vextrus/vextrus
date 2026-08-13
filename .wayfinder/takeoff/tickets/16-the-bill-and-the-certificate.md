# The Quantity Bill and the Certificate of Measured Coverage

wayfinder:prototype
Status: open
Blocked by: 01-the-work-item-catalogue.md, 10-the-design-system.md
Claimed by:

## Objective

The destination's terminal artifact. `quantity-contract.md` §6 specifies it in unusual detail
and almost none of it is obvious on a page — so prototype the document, then rule.

## What §6 already binds

- **The certificate is a query** over catalogue × scope register, **never prose**. A bill without
  its certificate **is not a bill and cannot be emitted**; they bind into **one server-generated
  PDF** (a browser print cannot guarantee the certificate travels).
- **No grand total under incomplete coverage** — a labelled *measured-scope subtotal* only.
- **The bill's face stays clean: no per-row marks.** A hatched "not measured" row inside a bill
  reads as *excluded from contract*, which is a worse lie.
- Missing item-selecting attributes publish the quantity **unpriced** (empty rate cells the
  arithmetic shows). Missing quantity-determining attributes keep the **row with no quantity** —
  *no line* is the most expensive defect.
- The **amount-in-words** belongs on the certificate, attached to a scope statement.
- **No coverage percentage prints** — by count it is meaningless, by value it would originate
  quantities outside the register.
- The certificate rides **every export channel** and is **never carried by colour alone**.
- Documents round the quantity **before** extension at a per-kind fixed precision; the register
  keeps full precision; the over-measurement block reads the **register** value, never the
  printed one.

## The decision

1. **What an unpriced bill looks like.** Every clause above was written for a *priced* bill.
   With no rates, "publish unpriced with empty rate cells" and "no grand total" both change
   meaning. Rule what the columns are and what the subtotal line says.
2. **Where scan-derived lines are disclosed** (ticket 03's question, answered on a page).
3. **The six-bill taxonomy** — `bd-authority.md` §9: Substructure · Superstructure · Finishes ·
   Electrical · Plumbing · External, as swappable data with en+bn names, resolved
   most-specific-first, `UNCLASSIFIED` kept and labelled and **never dropped**, the resolver
   recording which row decided. Prototype whether that reads clearly.
4. **Generation.** Server-generated PDF, and `cad-ingestion.md` §1 **bans AGPL PDF libraries in
   shipped code** with a licence test. Rule the generator now, since it constrains the design.
5. **Bangla.** A bill that goes to a BD client may need both languages on one page.

## Guardrails

- Lakh/crore grouping; `toLocaleString('en-US')` is banned; compact `L`/`Cr` **never** on a
  document (`CLAUDE.md`).
- SI-singular full precision in the register; documents own all presentation
  (`bd-authority.md` §3 — Weights and Measures Act 2018 §68 bars non-standard units in any
  document, and §68(2) in any written measurement record).
- Throwaway artifact. `/prototype` is the skill.
