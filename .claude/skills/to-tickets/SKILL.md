---
name: to-tickets
description: Break a spec, plan, or the current conversation into tracer-bullet build tickets with blocking edges, written to the wayfinder tracker — executable by the loop or by interactive sessions.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into **build tickets** — tracer-bullet vertical slices,
each declaring the tickets that **block** it. Build tickets live at
`.wayfinder/<effort>/arcs/<arc-id>/NN-<slug>.md` (see `.wayfinder/TRACKER.md`) — decision
tickets decide; these build.

## Process

### 1. Gather context

Work from the conversation. If the user passes a reference (a spec path, a map), read it fully.

### 2. Explore the codebase

Understand the current state. Use the domain glossary vocabulary; respect ADRs and the
`docs/domain/` law in the area. Look for prefactoring opportunities — "make the change easy,
then make the easy change."

### 3. Draft vertical slices

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer it touches (schema → API →
  UI → tests) — vertical, never a horizontal slice of one layer.
- A completed slice is demoable or verifiable on its own.
- Each slice is sized to a single fresh context window — **size tickets to sessions, never
  sessions to tickets**. Peak context tracks the legacy mass a worker must *read*, not its
  diff size.
- Prefactoring goes first.

</vertical-slice-rules>

**Wide refactors are the exception.** One mechanical change whose blast radius fans across the
codebase sequences as **expand–contract**: expand (add the new form beside the old), migrate
in batches sized by blast radius (each its own ticket blocked by the expand), contract (delete
the old form once no caller remains, blocked by every batch). CI stays green batch to batch.

### 4. Quiz the user

Present the breakdown as a numbered list — title, blocked-by, what it delivers. Ask: is the
granularity right? Are the blocking edges genuine? Merge or split? Iterate until approved.

### 5. Write the tickets

One file per ticket, numbered from `01` in dependency order, using the template below. Write
them for a **fresh session with no memory of this conversation** — the loop may execute them
headless. Acceptance criteria must be machine-checkable wherever possible; `pnpm verify` green
is implicit in every ticket and still worth stating when the ticket adds checks.

<ticket-template>

# <Ticket name>

wayfinder:task
Status: open
Blocked by: <NN-<slug>.md list, or empty>
Claimed by:

## What to build

The end-to-end behaviour this ticket makes work — not a layer-by-layer implementation list.
Cite the binding `docs/domain/` clauses and the seams under test.

## Acceptance criteria

- [ ] Criterion 1 (machine-checkable)
- [ ] Criterion 2

</ticket-template>

Avoid file paths and code snippets that will go stale; a prototype-derived snippet encoding a
decision is the exception. Do NOT modify the parent spec or map beyond linking the arc.
