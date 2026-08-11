---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs,
   first-party APIs, statute text — not a secondary write-up of them. Follow every claim back
   to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source. Flag anything
   that could not be verified — never guess a rate, a clause, or a version.
3. Save it to `docs/research/<slug>.md` — this repo's convention.

If the research resolves a wayfinder ticket, the ticket's resolution links the file; the file
holds the detail, the ticket holds the ruling.
