# ADR-0006 — Locality is data and config, never code

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

Bangladesh is the launch wedge, not the architecture. Research findings that force the shape:
PWD/LGED/RHD Schedules of Rates revise on irregular cadences and a unified national schedule is
imminent; zone letters map to *different* districts per schedule; "SoR 2022" denotes three
distinct rate sets, so an edition mismatch is a pricing error; VAT needs both percentage and
fixed-taka-per-unit modes and construction rates changed twice in three years; Bangladesh has
no national method of measurement, so deduction thresholds are imported Indian convention;
the Weights and Measures Act 2018 §68 makes SI storage a statutory requirement.

## Decision

- **Rate books** are effective-dated datasets: book + edition + effective date + per-book
  zone→district mapping + verbatim published rates (VAT-inclusive as printed, derivations
  stored, never recomputed history). A new schedule — including the coming unified one — is a
  new dataset, zero code.
- **Tax rules** are effective-dated config keyed (code, category, payee type, fiscal year),
  supporting percentage and per-unit fixed amounts. Headline rates appear only in seed data
  sanity checks.
- **Measurement rule sets** are versioned data with clause citations, pinned per project; the
  seed deduction thresholds are labeled IS 1200 (Indian) because no BD authority exists —
  mislabeling them Bangladeshi was a named legacy defect. Parameters are config; methods (e.g.
  rebar volume never deducted) are code, enumerated by (rule id, version).
- **The register stores SI-singular, full precision** (Act 2018 §68). Imperial is legal only as
  an input read off a sheet, retained as provenance. Documents own presentation: lakh/crore
  grouping, `DD MMM YYYY`, July–June fiscal year, Bangla/English strings, per-kind fixed
  rounding applied before extension.

## Consequences

- Going global is adding datasets and document conventions (NRM2, CESMM, MasterFormat are
  output groupings over the same register), not forking code.
- The SoR digitisation pipeline (extract → human QA gate → refuse-on-flag → load) is a
  first-class product asset; no LLM output reaches the database unreviewed.
- Nothing rate- or tax-shaped is ever a constant; the NEVER rule in CLAUDE.md is the guardrail,
  and seeds carry source hashes and citations.
