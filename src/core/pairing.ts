import type { ElementType, LevelBasis } from "./enums";

/**
 * The identity law, pure (identity.md §3–§5): what a sighting claims, how a
 * mark family's ordinals are derived, what a row's **semantic** is, and how a
 * revision **pairs** with what the register already froze.
 *
 * Nothing here touches the database, a clock or a quantity. The register's door
 * (`register.ts`) is the only caller that turns these claims into rows.
 */

/**
 * A sighting offered at the register's door: one placed instance, described
 * only by content (§3 — content-derived keys, zero minted ids).
 */
export type Sighting = {
  /** Placement key (§3): view key + mark + coordinates quantized to 0.1 unit.
   *  Idempotency and provenance — **never** part of the identity key. */
  placementKey: string;
  viewKey: string;
  elementType: ElementType;
  /** The drawing's own mark string. */
  mark: string;
  /** The dotless-uppercase compare form: two spellings, one family
   *  (cad-ingestion.md §9). */
  family: string;
  /** Content signature of authored inputs ONLY, fixed-precision (§4).
   *  Correctable attributes — height, grade, rebar spec — are excluded. */
  signature: string;
  levelId?: string;
  levelBasis: LevelBasis;
  /** The DXF handles this sighting cites (cad-ingestion.md §2). */
  handles: string[];
};

/**
 * The identity a sighting claims, plus the human-facing key form: `mark#i`
 * within a mark family of several, the bare mark for a singleton (§4).
 */
export type ClaimedIdentity = {
  sighting: Sighting;
  mark: string;
  ordinal: number;
  key: string;
};

/**
 * The dotless compare form of a mark (cad-ingestion.md §9): `T.B` and `TB` are
 * one family. The one site of the rule — the takeoff module's `markFamilyOf`
 * normalises the drawing's spelling and then defers to this.
 */
export function markFamily(mark: string): string {
  return mark.replaceAll(".", "").toUpperCase();
}

/** A family is the identity key's own axes minus the ordinal (§4). */
function familyKeyOf(part: {
  elementType: ElementType;
  levelBasis: LevelBasis;
  levelId?: string | null;
  family: string;
}): string {
  return [part.elementType, part.levelBasis, part.levelId ?? "", part.family].join("|");
}

const keyForm = (mark: string, ordinal: number, indexed: boolean): string =>
  indexed ? `${mark}#${ordinal}` : mark;

/**
 * Ordinals, by identity.md §4 and nothing else:
 *
 * - A **mark family** is one (element class, level slot, dotless mark) — the
 *   identity key's own axes minus the ordinal. Two classes sharing a mark
 *   string are two families, and so are two levels.
 * - Its members sort by a canonical **content signature of authored inputs
 *   only**, tie-broken by the row's own id — here the placement key, the one
 *   axis no correction can touch, since a placement mints no id at all.
 * - The ordinal is that 1-based index. It is assigned once, at first
 *   registration, and this function is deliberately the only place it is
 *   derived: an ordinal re-derived from moved geometry migrates, which is the
 *   exact defect the freeze exists to prevent. Across a revision the ordinal is
 *   **inherited** instead — see `pairRevision`.
 * - A family of one keeps the bare mark as its key form; its ordinal is still
 *   1, so a family that later grows gains an index without moving anybody.
 *
 * A family's members may be spelled two ways (`T.B` / `TB`); the family
 * registers under the spelling of its first-sorted member, so one physical
 * family is never two register families.
 */
export function familyIdentities(sightings: Sighting[]): ClaimedIdentity[] {
  const families = new Map<string, Sighting[]>();
  for (const sighting of sightings) {
    const key = familyKeyOf(sighting);
    families.set(key, [...(families.get(key) ?? []), sighting]);
  }
  const claims: ClaimedIdentity[] = [];
  for (const members of families.values()) {
    const sorted = sortByContent(members);
    const mark = sorted[0]!.mark;
    for (const [i, sighting] of sorted.entries()) {
      const ordinal = i + 1;
      claims.push({
        sighting,
        mark,
        ordinal,
        key: keyForm(mark, ordinal, sorted.length > 1),
      });
    }
  }
  return claims.sort((a, b) =>
    a.sighting.placementKey.localeCompare(b.sighting.placementKey),
  );
}

/** §4's canonical order: content signature first, the row's own id to break a tie. */
function sortByContent(sightings: Sighting[]): Sighting[] {
  return [...sightings].sort(
    (a, b) =>
      a.signature.localeCompare(b.signature) ||
      a.placementKey.localeCompare(b.placementKey),
  );
}

/* --------------------------------- semantic -------------------------------- */

/** Canonical JSON: object keys in sorted order at every depth, so two equal
 *  contents serialise to the identical string whatever order they were built in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The row's **semantic** (identity.md §5): an order-normalized canonical JSON
 * of its content *including its cited evidence handles*. It is the
 * **invalidator, never the key** — an unchanged semantic carries filed human
 * dispositions forward across a rebuild, a changed one re-presents the row for
 * disposition.
 *
 * Lineage sits inside it deliberately: a row whose numbers are unchanged but
 * whose cited evidence moved must re-present, or a stale lineage rides forward
 * invisibly. The anchor is the placement key's own quantized position — a move
 * is a change to disposition even though position is never identity.
 */
export function sightingSemantic(sighting: Sighting): string {
  return canonical({
    anchor: placementAnchor(sighting.placementKey),
    elementType: sighting.elementType,
    family: sighting.family,
    handles: [...sighting.handles].sort(),
    levelBasis: sighting.levelBasis,
    levelId: sighting.levelId ?? null,
    mark: sighting.mark,
    signature: sighting.signature,
    viewKey: sighting.viewKey,
  });
}

/**
 * The quantized world anchor a placement key already carries (§3's grammar:
 * `<view key>|<mark>|<x>|<y>`). Read back, never re-measured — pairing across a
 * revision compares positions at exactly the resolution the key was cut at. A
 * key that does not state a position states none: null, never a guessed origin.
 */
export function placementAnchor(placementKey: string): [number, number] | null {
  const parts = placementKey.split("|");
  if (parts.length < 4) return null;
  const x = Number(parts[parts.length - 2]);
  const y = Number(parts[parts.length - 1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/* --------------------------------- pairing --------------------------------- */

/**
 * What the register already froze for one member of this drawing: its identity,
 * and the sighting that last evidenced it. The prior is the *latest* sighting
 * per register object — a superseded placement is history, never a pairing
 * candidate.
 */
export type PriorSighting = {
  objectId: string;
  placementKey: string;
  viewKey: string;
  semantic: string;
  elementType: ElementType;
  mark: string;
  ordinal: number;
  levelBasis: LevelBasis;
  levelId: string | null;
};

/**
 * How a claim reached its ordinal:
 * - `EXACT` — the same placement key this drawing already registered.
 * - `NUDGED` — the member moved; the ordinal is inherited through pairing (§4).
 * - `APPENDED` — an addition to a family that has priors in this view: the next
 *   free ordinal, never a retired one.
 * - `FRESH` — a family with no prior sighting in this view: ordinals derive
 *   from this batch (first registration, or a second sighting that the door's
 *   double-count guard will refuse).
 */
export type Carry = "EXACT" | "NUDGED" | "APPENDED" | "FRESH";

export type PairedClaim = ClaimedIdentity & {
  carry: Carry;
  prior: PriorSighting | null;
  /** Why this claim carries the ordinal it carries — never silent. */
  reason: string;
};

/** A prior identity this revision does not sight: a named disposition, never a
 *  silent absence. Its ordinal stays retired — no sibling inherits it. */
export type VacatedIdentity = { prior: PriorSighting; reason: string };

export type Pairing = { claims: PairedClaim[]; vacated: VacatedIdentity[] };

export type PairRevisionInput = {
  offered: Sighting[];
  priors: PriorSighting[];
  /**
   * Per view key, the distance within which a moved member is still the same
   * member — a **share of that view's own minimum grid spacing** (the takeoff
   * module owns the share; a length in drawing units is a guessed scale). A
   * view with no stated bound carries nobody across a move, and says so.
   */
  carryBounds: Record<string, number>;
  /** The view keys this pass actually walked. A prior of a walked view that
   *  nothing sights is vacated; a view this pass never opened says nothing
   *  about its members. Defaults to the views the offered sightings name. */
  walkedViewKeys?: string[];
};

/**
 * **Pairing across a revision** (identity.md §4–§5). The register reports a
 * delta, not a do-over: an unchanged member keeps its frozen ordinal, a moved
 * member inherits it, a deleted member's ordinal is retired by name, and an
 * addition takes the next free index. Position is *pairing evidence* and never
 * identity — the key stays (project, discipline, level, class, mark, ordinal).
 *
 * The order below is the whole law:
 *
 * 1. **Exact placement key.** Content-derived keys make an unmoved member
 *    recognise itself with no matching at all.
 * 2. **Nearest within the carry bound, same view.** Greedy on the globally
 *    smallest distance so the result cannot depend on input order; a tie is
 *    *refused by name* rather than merged, because a wrong merge silently
 *    deletes quantity (§2). This is the clause that keeps a nudged member's
 *    ordinal off its surviving siblings when a sibling was deleted in the same
 *    revision.
 * 3. **Appended, or fresh.** An offer left over in a view where its family has
 *    priors is an addition and takes the next free ordinal — never a retired
 *    one. An offer whose family has no prior *in this view* derives from the
 *    batch: that is first registration, and it is also how a second sighting
 *    from another view still collides with the identity it duplicates.
 * 4. **Vacated.** Every prior of a walked view that no claim took is reported,
 *    with its reason. Silence is the condemned state.
 */
export function pairRevision(input: PairRevisionInput): Pairing {
  const walked = new Set(
    input.walkedViewKeys ?? input.offered.map((s) => s.viewKey),
  );
  const offersByFamily = new Map<string, Sighting[]>();
  for (const sighting of input.offered) {
    const key = familyKeyOf(sighting);
    offersByFamily.set(key, [...(offersByFamily.get(key) ?? []), sighting]);
  }
  const priorsByFamily = new Map<string, PriorSighting[]>();
  for (const prior of input.priors) {
    const key = familyKeyOf({ ...prior, family: markFamily(prior.mark) });
    priorsByFamily.set(key, [...(priorsByFamily.get(key) ?? []), prior]);
  }

  const claims: PairedClaim[] = [];
  const vacated: VacatedIdentity[] = [];

  for (const [family, offers] of offersByFamily) {
    const priors = priorsByFamily.get(family) ?? [];
    const taken = new Set<string>();
    const indexed = Math.max(priors.length, offers.length) > 1;
    const registeredMark = priors.length > 0 ? priors[0]!.mark : null;
    const inherit = (
      sighting: Sighting,
      prior: PriorSighting,
      carry: Carry,
      reason: string,
    ): void => {
      taken.add(prior.objectId);
      claims.push({
        sighting,
        mark: prior.mark,
        ordinal: prior.ordinal,
        key: keyForm(prior.mark, prior.ordinal, indexed),
        carry,
        prior,
        reason,
      });
    };

    // 1. the unmoved: the placement key recognises itself
    const byKey = new Map(priors.map((p) => [p.placementKey, p]));
    const moved: Sighting[] = [];
    for (const sighting of offers) {
      const prior = byKey.get(sighting.placementKey);
      if (prior === undefined) {
        moved.push(sighting);
        continue;
      }
      inherit(
        sighting,
        prior,
        "EXACT",
        `placement ${sighting.placementKey} is the one this drawing already registered as ${keyForm(prior.mark, prior.ordinal, indexed)} — the identity is inherited unmoved`,
      );
    }

    // 2. the moved: nearest unclaimed prior of the same view, within the bound
    const unpaired = new Map<string, string>();
    const rest = pairByProximity(moved, priors, taken, input.carryBounds, inherit, unpaired);

    // 3. what is left is an addition, or a family this view has never sighted
    const appended: Sighting[] = [];
    const fresh: Sighting[] = [];
    for (const sighting of rest) {
      (priors.some((p) => p.viewKey === sighting.viewKey) ? appended : fresh).push(
        sighting,
      );
    }
    let next = priors.reduce((max, p) => Math.max(max, p.ordinal), 0);
    for (const sighting of sortByContent(appended)) {
      next += 1;
      const mark = registeredMark ?? sighting.mark;
      claims.push({
        sighting,
        mark,
        ordinal: next,
        key: keyForm(mark, next, true),
        carry: "APPENDED",
        prior: null,
        reason: `${unpaired.get(sighting.placementKey) ?? `placement ${sighting.placementKey} pairs with no prior member of this family in view ${sighting.viewKey}`} — it registers as an addition at the next free ordinal ${next}; a retired ordinal is never reused (identity.md §4)`,
      });
    }
    for (const claim of familyIdentities(fresh)) {
      claims.push({
        ...claim,
        carry: "FRESH",
        prior: null,
        reason: `family ${claim.sighting.family} has no prior sighting in view ${claim.sighting.viewKey}, so its ordinals derive from this batch (identity.md §4)`,
      });
    }

    // 4. the absent: every prior of a walked view that nothing sighted
    for (const prior of priors) {
      if (taken.has(prior.objectId) || !walked.has(prior.viewKey)) continue;
      vacated.push({
        prior,
        reason: `${keyForm(prior.mark, prior.ordinal, indexed)}, last sighted at placement ${prior.placementKey}, is absent from this revision of view ${prior.viewKey} — a removed member is a named disposition, and its ordinal stays retired`,
      });
    }
  }

  // a walked view may lose a whole family — its priors are vacated too
  for (const [family, priors] of priorsByFamily) {
    if (offersByFamily.has(family)) continue;
    const indexed = priors.length > 1;
    for (const prior of priors) {
      if (!walked.has(prior.viewKey)) continue;
      vacated.push({
        prior,
        reason: `${keyForm(prior.mark, prior.ordinal, indexed)}, last sighted at placement ${prior.placementKey}, is absent from this revision of view ${prior.viewKey} — its whole mark family is unsighted, which is a named disposition, never a silent absence`,
      });
    }
  }

  claims.sort((a, b) => a.sighting.placementKey.localeCompare(b.sighting.placementKey));
  vacated.sort((a, b) => a.prior.placementKey.localeCompare(b.prior.placementKey));
  return { claims, vacated };
}

/**
 * §4's pairing step, order-independent by construction: every admissible
 * (offer, prior) pair is scored, the globally smallest distance is taken first,
 * and a distance two priors share is no pairing at all — the ambiguity is
 * recorded as the offer's reason and it goes on to present itself.
 */
function pairByProximity(
  moved: Sighting[],
  priors: PriorSighting[],
  taken: Set<string>,
  carryBounds: Record<string, number>,
  inherit: (s: Sighting, p: PriorSighting, carry: Carry, reason: string) => void,
  unpaired: Map<string, string>,
): Sighting[] {
  type Candidate = { sighting: Sighting; prior: PriorSighting; d: number };
  const candidates: Candidate[] = [];
  for (const sighting of moved) {
    const bound = carryBounds[sighting.viewKey];
    const at = placementAnchor(sighting.placementKey);
    if (bound === undefined) {
      unpaired.set(
        sighting.placementKey,
        `view ${sighting.viewKey} states no carry bound — a share of its own grid spacing — so no member of it is carried across a move`,
      );
      continue;
    }
    if (at === null) {
      unpaired.set(
        sighting.placementKey,
        `placement ${sighting.placementKey} states no position, so it can be paired with no prior member`,
      );
      continue;
    }
    for (const prior of priors) {
      if (taken.has(prior.objectId) || prior.viewKey !== sighting.viewKey) continue;
      const was = placementAnchor(prior.placementKey);
      if (was === null) continue;
      const d = Math.hypot(at[0] - was[0], at[1] - was[1]);
      if (d <= bound) candidates.push({ sighting, prior, d });
    }
    if (!candidates.some((c) => c.sighting === sighting)) {
      unpaired.set(
        sighting.placementKey,
        `no prior member of this family sits within ${bound} drawing units of placement ${sighting.placementKey} in view ${sighting.viewKey}`,
      );
    }
  }
  candidates.sort(
    (a, b) =>
      a.d - b.d ||
      a.sighting.placementKey.localeCompare(b.sighting.placementKey) ||
      a.prior.placementKey.localeCompare(b.prior.placementKey),
  );

  const settled = new Set<string>();
  const inherited = new Set<string>();
  for (const candidate of candidates) {
    const { sighting, prior, d } = candidate;
    if (settled.has(sighting.placementKey) || taken.has(prior.objectId)) continue;
    const tie = candidates.filter(
      (c) =>
        c.sighting === sighting &&
        c.d === d &&
        !taken.has(c.prior.objectId) &&
        c.prior !== prior,
    );
    if (tie.length > 0) {
      settled.add(sighting.placementKey);
      unpaired.set(
        sighting.placementKey,
        `placement ${sighting.placementKey} sits exactly ${d} drawing units from ${tie.length + 1} prior members of its family — which one it continues is not stated, so none is merged`,
      );
      continue;
    }
    settled.add(sighting.placementKey);
    inherited.add(sighting.placementKey);
    inherit(
      sighting,
      prior,
      "NUDGED",
      `moved ${d.toFixed(1)} drawing units from placement ${prior.placementKey}, within view ${sighting.viewKey}'s carry bound — position is not identity (identity.md §2), so ordinal ${prior.ordinal} is inherited unmoved`,
    );
  }
  // an ambiguous pair is no pair: the offer is not inherited, and goes on to
  // present itself with the ambiguity as its stated reason
  return moved.filter((s) => !inherited.has(s.placementKey));
}
