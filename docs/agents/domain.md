# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** `docs/CONTEXT.md` (commercial truth, glossary, Bangladesh rules), `docs/adr/` for decisions that constrain product code, and `docs/domain/` — the domain law.

## Before exploring, read these

- **`docs/CONTEXT.md`** — this repo keeps it under `docs/`, not at the root.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.
- **`docs/domain/`** — the domain law (identity, quantity contract, measurement rules, formulas, BD authority, CAD ingestion). Normative: read the files relevant to your topic before proposing changes; cite the clause you implement; a conflict is surfaced as a dated amendment, never silently overridden.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── docs/CONTEXT.md        ← commercial truth, glossary, Bangladesh rules
├── docs/domain/           ← the domain law (six files)
├── docs/adr/              ← 0001-…md, decisions that constrain product code
├── docs/lessons/          ← one paid-for fault per file
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
