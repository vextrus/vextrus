# Domain docs — how a skill or a delegated reader consumes this repo's law

**Layout: single-context.** One glossary, one ADR directory, one body of domain law, all under
`docs/`. Nothing lives at the root except `CLAUDE.md` and `README.md`.

| file | what it is | read it when |
|---|---|---|
| `docs/CONTEXT.md` | commercial truth, the glossary, Bangladesh rules — what the code cannot tell you | anything user-facing, commercial or domain-specific |
| `docs/domain/*.md` | **the law**: quantity contract, identity, measurement rules, BD authority, formulas, CAD ingestion — normative | before implementing or judging anything that measures, identifies, prices or ingests; cite the clause |
| `docs/adr/NNNN-*.md` | decisions that constrain product code; superseded by a dated ADR, never edited | before proposing a structural change; a conflict is surfaced, never silently overridden |
| `docs/specs/genesis-ii.md` | the founding spec — thesis, differentiators, §3 what binds the harness, §7 the measured verify contract | when a change touches how the repo works rather than what it does |
| `docs/specs/harness.md` | how the takeoff module is planned and built — the pipeline, the ticket contract, model and effort per class, the metrics; **proposed**, so §3 governs where they disagree | before charting a map, writing a build ticket, or proposing anything that would run Claude |
| `docs/lessons/*.md` | one paid-for fault per file, dated | first, when something is broken and the code looks right |
| `docs/research/*.md` | the market and the harness, re-examined against primary sources | when a claim about a competitor, a rate book or a Claude Code feature needs a source |

## Rules for consumers

- **Use the glossary's vocabulary.** An issue title, a hypothesis, a test name uses the term as
  `docs/CONTEXT.md` defines it (basis, coverage, act, proposal, source key …). A concept the
  glossary lacks is a signal: either the language is invented (reconsider) or there is a gap
  (note it for `/domain-modeling`).
- **Cite the clause.** Code implements a numbered section of `docs/domain/`; an issue names the
  clause it builds; a review checks the clause, not a paraphrase of it.
- **A change to the law is a dated amendment in the same PR**, never an edit that reads as if it
  had always been so.
- **Flag ADR conflicts explicitly** — *contradicts ADR-0004 (typed tenancy seam) because …* — and
  leave the decision to a superseding ADR or the founder.
- **Delegated readers do not see `CLAUDE.md`.** Explore and Plan subagents start without it; a
  delegation prompt that needs the law names the file and the clause.
- **`docs/lessons/` is the memory surface.** Auto memory is off in `.claude/settings.json`; what
  a session learns at a dated, observed cost goes into one lesson file through a PR, where every
  machine and CI can see it.
