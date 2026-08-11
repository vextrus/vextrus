---
name: to-spec
description: Turn the current conversation into a spec and publish it to docs/specs/ — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a
spec. Do NOT interview the user — just synthesize what you already know.

## Process

1. Explore the repo to understand the current state, if you haven't already. Use the domain
   glossary vocabulary (`docs/CONTEXT.md`), respect the ADRs in the area, and cite the
   `docs/domain/` law wherever the spec touches quantities, identity, or pricing.

2. Sketch the **seams** at which the feature will be tested. Prefer existing seams; use the
   highest seam possible; the fewer the better — the ideal number is one. Check with the user
   that these seams match their expectations.

3. Write the spec using the template below and save it to `docs/specs/<slug>.md`.

<spec-template>

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution, from the user's perspective.

## User Stories

A numbered list: As an <actor>, I want <feature>, so that <benefit>. Extensive — cover all
aspects of the feature.

## Implementation Decisions

The modules built/modified, their interfaces, schema changes, API contracts, architectural
decisions, technical clarifications. Do NOT include specific file paths or code snippets —
they go stale fast. Exception: a prototype-derived snippet that encodes a decision more
precisely than prose (state machine, reducer, schema, type shape) — inline the decision-rich
part and note its origin.

## Testing Decisions

What makes a good test here (external behavior only, never implementation details), which
seams are under test, prior art in the codebase.

## Out of Scope

What this spec deliberately excludes.

## Further Notes

</spec-template>
