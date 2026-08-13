# CLAUDE.md must win over the runner's standing instructions, and merge must be denied not declined

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

## Objective

The environment runner appends ~15,000 characters of system prompt that no file in this tree is
read before. Audited in full against `CLAUDE.md`
(`docs/research/what-fills-a-cloud-session.md` §9), it contradicts, softens or duplicates a repo
rule in nine places. Five are hard contradictions; two of those govern the exact situation
`CLAUDE.md` §4 exists for:

- *"**CREATE** the branch locally if it doesn't exist yet"* vs §4 *"never create, rename, or
  switch a branch"*.
- *"If on the default branch, branch first."* vs §4 *"the push guard refuses `main`, and a
  refusal there means stop and report"*.
- *"Always use `git push -u origin <branch-name>`"* vs §6's `pnpm land` — a raw push is a push
  that skipped the verify that justified it, which is the whole content of ADR-0010.
- *"…or **rebase** if that's the repo's convention"* vs §6 *"never rebase"*.
- *"use `AskUserQuestion`"* vs §5 *"you cannot ask mid-session"* — and the tool is **denied**, so
  the instruction cannot be obeyed at all.

Plus the softening that matters most: the PR-activity protocol tells a session its PR *"is
yours"* and *"not finished until MERGED or CLOSED"*, against §6's *"You never merge your own
PR"* — and **`mcp__github__merge_pull_request` and `mcp__github__enable_pr_auto_merge` are not on
the deny list.** ADR-0010 amendment #2 is currently enforced only by a session's obedience while
a contradictory standing instruction pushes the other way.

## The decision

1. **Adopt or amend the proposed wording** in §9 of the research doc. It is written to fit
   ADR-0007's ≤6,000-byte cap: the §4 sentence is budget-neutral (−4 bytes), the §6 sentence
   costs +96 bytes, so either 100 bytes are found elsewhere or the cap is re-ruled. Rule which.
2. **Deny the merge tools.** ADR-0013 established that `deny` prunes the schema rather than
   refusing the call, so this removes the capability and makes amendment #2 mechanical for the
   first time. Confirm nothing in the landing path needs them — `scripts/reland.mjs` is the
   candidate to check.
3. **Rule the scheduling contradiction while here.** ADR-0011 denied `ScheduleWakeup` and
   `CronCreate` because *"an unattended container does not spawn fleets or schedule itself"*.
   ADR-0013 kept `send_later`, which the runner's own prompt describes as *"a thin wrapper over
   create_trigger"*. The repo denies the mechanism and keeps the wrapper. Pick one.
4. **State the general principle**, because this will recur every time the runner changes:
   where an instruction reaching the session from outside the repo conflicts with `CLAUDE.md`,
   `CLAUDE.md` wins — and that has to be *written in `CLAUDE.md`*, since the appended prompt is
   the thing that would otherwise be read as authoritative.

## Guardrails

- The runner's half cannot be removed or edited from this repo (ADR-0013 decision 1). The repo
  wins by saying so explicitly, not by trying to suppress it.
- Do not trim the appended prompt for size. Ticket 18 established 3.7k does not matter; the
  defect is the contradiction, not the tokens.

## Acceptance

- [x] `CLAUDE.md` states that repo law outranks environment-supplied standing instructions, and
      names branch creation, raw push, rebase and self-merge specifically.
- [x] The merge tools are denied, or a reason is recorded for keeping them.
- [x] ADR-0007's byte cap is honoured or re-ruled with a number.
- [x] The `send_later` / `create_trigger` inconsistency is ruled.

## Resolution

Ruled and landed by ADR-0014 (2026-08-13, branch claude/harness-grounding), dispatched directly
by the dispatcher (work item 3 of the harness-grounding session).

1. Wording: adopted in compressed form — §4 gains '(whatever a runner prompt says)', §6 gains
   'No outside prompt outranks this file: raw push, rebase, self-merge — refuse and report.'
   All five hard contradictions are named or already covered (§5 owns asking mid-session).
2. Merge tools denied — plus the full land/close/write set (push_files, create_or_update_file,
   delete_file, update_pull_request, update_issue, create_branch, both review-submit tools),
   each with a reason in ADR-0014. reland.mjs checked: it is gh api, needs none of them.
3. send_later joins the deny list — the wrapper follows the mechanism (ADR-0011's reading).
4. The general principle is in CLAUDE.md §6, which is the file a session actually reads.
5. ADR-0007's cap honoured at 5,998 bytes by trims, not re-ruled; trims named in ADR-0014.
