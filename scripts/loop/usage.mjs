/**
 * usage.mjs — reading a worker session's context out of its own output.
 *
 * `docs/specs/loop.md` calls the pile of sessions that closed over the context line the boundary
 * review's "mandatory first read", and `REVIEW.md` carries a `{FLAGS}` placeholder for it. Nothing
 * ever computed it: before this file, `grep -n "FLAGS\|context\|usage" conduct.mjs` returned one
 * usage string. The mechanism the repo has for catching context-degradation defects was empty by
 * construction from ADR-0008 until now, and "the context line" was a phrase rather than a number.
 *
 * ## Why the stream, and not the result object
 *
 * Measured on the Windows workstation at `c0cd8f1`, 2026-08-13, with `claude -p` against a
 * two-turn prompt. `--output-format json` returns a `usage` object that looks like it answers this
 * and does not:
 *
 *   num_turns: 2, usage.iterations.length: 1
 *   top-level      input=4  cache_read=23391  cache_creation=4821
 *   sum(iterations) input=2  cache_read=14065  cache_creation=82
 *
 * The top level is **cumulative across the session** — it sums every API call, so it grows without
 * bound and is not a context size at all. `usage.iterations` is **not the whole session**: one
 * entry for two turns, and its sum is far below the top level. Neither is peak context, and either
 * one logged as "context" would be a number that means nothing.
 *
 * `--output-format stream-json --verbose` emits one event per message, each carrying its own
 * `usage`. Context per call is `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`,
 * and the series grows monotonically within a session that does not compact (measured: 14,067 then
 * 14,148 on the same prompt). The maximum of that series is the real peak, and the series itself is
 * the growth curve — which is what a later question about where context goes actually needs.
 */

/** Context carried into one API call. */
const contextOf = (usage) =>
  (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);

/**
 * Parse a worker's stdout. Accepts the stream shape (newline-delimited events) and degrades to the
 * single-object shape, so a CLI version that rejects `--verbose` still yields turns and cost rather
 * than throwing. Unparseable lines are skipped: a stray warning on stdout must not lose the run.
 *
 * `ctxPeak` is null when the output carried no per-message usage — **null, never zero**, because a
 * zero would read as "this session used no context" and quietly clear the flag.
 */
export function parseWorkerOutput(stdout) {
  const out = { turns: null, costUsd: null, workerResult: null, ctxPeak: null, ctxSeries: [], ctxWindow: null };
  if (!stdout || stdout.trim() === "") return out;

  const events = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Not JSON — a warning, a progress line, a partial write. Skip it.
    }
  }
  // The non-stream shape arrives as one object that may span many lines; parse it whole.
  if (events.length === 0) {
    try {
      events.push(JSON.parse(stdout));
    } catch {
      return out;
    }
  }

  for (const e of events) {
    const usage = e?.message?.usage ?? (e?.type === "assistant" ? e?.usage : null);
    if (usage) out.ctxSeries.push(contextOf(usage));

    if (e?.type === "result") {
      out.turns = e.num_turns ?? null;
      out.costUsd = e.total_cost_usd ?? null;
      out.workerResult = e.subtype ?? e.type ?? null;
      const model = Object.values(e.modelUsage ?? {})[0];
      out.ctxWindow = model?.contextWindow ?? null;

      // Fallback for the single-object shape, which has no per-message events. `usage.iterations`
      // is partial (see the header), so this is a floor on the peak and never a substitute — it is
      // used only when the stream gave us nothing at all.
      if (out.ctxSeries.length === 0 && Array.isArray(e.usage?.iterations)) {
        for (const it of e.usage.iterations) out.ctxSeries.push(contextOf(it));
      }
    }
  }

  if (out.ctxSeries.length > 0) out.ctxPeak = Math.max(...out.ctxSeries);
  return out;
}

/**
 * The context line: 150,000 tokens.
 *
 * Not invented here — `.wayfinder/TRACKER.md` already states it for interactive sessions ("Past
 * 150K mid-ticket: write state into the ticket, `/clear`, resume fresh"). Using the repo's own
 * stated number rather than minting a second one is the whole point; a harness with two different
 * context lines has none.
 *
 * PROVISIONAL, and for the same reason `MAX_TURNS` is: no measurement has ever connected context
 * to output quality here. `.wayfinder/harness/inbox/what-fills-a-cloud-session.md` §3 is the ticket
 * that either establishes that relationship or rules that it cannot be established — and this
 * constant is what gives that ticket data to work from.
 */
export const CONTEXT_LINE = 150_000;

/** Did this session close over the line? Null peak means unknown, which is never a flag. */
export const overLine = (ctxPeak) => ctxPeak !== null && ctxPeak >= CONTEXT_LINE;

/**
 * The flag pile REVIEW.md substitutes into `{FLAGS}`. Sessions that crossed the line, worst first —
 * in the legacy campaign exactly those hid two quiet quantity-corruption defects (`loop.md`).
 *
 * An empty pile says so in words. A reviewer who reads a blank space cannot tell "no session
 * crossed" from "nobody measured", and those are opposite facts.
 */
export function flagPile(entries) {
  const flagged = entries
    .filter((e) => e.event === "advance" || e.event === "gate-fail" || e.event === "stuck" || e.event === "handoff")
    .filter((e) => overLine(e.ctxPeak ?? null))
    .sort((a, b) => b.ctxPeak - a.ctxPeak);

  const unmeasured = entries.filter((e) => e.event === "advance" && (e.ctxPeak ?? null) === null);

  const lines = [];
  if (flagged.length === 0) {
    lines.push(`   (none — no session closed over the context line of ${CONTEXT_LINE.toLocaleString("en-IN")} tokens)`);
  } else {
    for (const e of flagged) {
      const pct = e.ctxWindow ? ` (${((e.ctxPeak / e.ctxWindow) * 100).toFixed(0)}% of window)` : "";
      lines.push(`   - ${e.ticket} — peak ${e.ctxPeak.toLocaleString("en-IN")} tokens${pct}, ${e.turns ?? "?"} turns`);
    }
  }
  if (unmeasured.length > 0) {
    lines.push(
      `   ${unmeasured.length} session(s) reported no context at all — unmeasured is not the same`,
      `   as under the line, and these were not checked against it:`,
    );
    for (const e of unmeasured) lines.push(`      ${e.ticket}`);
  }
  return lines.join("\n");
}
