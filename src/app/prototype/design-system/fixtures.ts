/**
 * PROTOTYPE FIXTURES — ticket 10 (the design system). Nothing here is read
 * from a register; it is shaped like one so the variants are judged on a QS's
 * actual day rather than on lorem ipsum (the ticket's third guardrail).
 *
 * Every value traces to the domain law: basis/coverage from
 * `quantity-contract.md` §1, refusal causes from §2 and `src/core/enums.ts`,
 * the queue's acts from `identity.md` §2/§5/§6/§7 and `cad-ingestion.md` §8.
 */

export type BasisValue =
  | "MEASURED"
  | "TRANSCRIBED"
  | "DERIVED"
  | "IMPORTED"
  | "ENTERED"
  | "INTERPRETED"
  | "DEFAULTED";

export type Coverage = "COMPLETE" | "PARTIAL_DECLARED";

/** Mirrors `refusalCauses` in src/core/enums.ts — the prototype may not import the spine. */
export type RefusalCause =
  | "NOT_ESTABLISHED"
  | "NOT_IN_PROJECT_SCOPE"
  | "NOT_IN_THIS_BILL"
  | "INGESTION_TRUNCATED"
  | "ENTITY_TYPE_UNHANDLED";

export interface BillLine {
  itemNo: string;
  description: string;
  unit: string;
  /** Decimal string, never a float (CLAUDE.md). `null` = a quantity-determining attribute is missing: the row keeps its place with no quantity (§6). */
  quantity: string | null;
  /** `null` = an item-selecting attribute is missing: publish unpriced, empty rate cell the arithmetic shows (§6). */
  rate: string | null;
  amount: string | null;
  quantityBasis: BasisValue;
  selectionBasis: BasisValue;
  coverage: Coverage;
  /** §3: the (drawing, view) a line was read from is a mandatory citation. */
  source: string;
  /** Enumerated on the row wherever coverage is PARTIAL_DECLARED (§1). */
  omitted?: string[];
  /** §3: rule id + version wherever basis is DERIVED. */
  rule?: string;
  /** §3: vectorizer id + version + render DPI wherever basis is INTERPRETED. */
  vectorizer?: string;
}

export const billLines: BillLine[] = [
  {
    itemNo: "3.02",
    description:
      "Cast-in-situ RCC in columns, 1:1.5:3, incl. shuttering removal and curing, ground floor to 1st floor",
    unit: "m³",
    quantity: "48.720",
    rate: "9850.00",
    amount: "479892.00",
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    coverage: "COMPLETE",
    source: "S-201 rev C · plan view",
  },
  {
    itemNo: "3.07",
    description: "MS deformed bar reinforcement, 500W, cut bent and placed in tie/grade beams",
    unit: "kg",
    quantity: "6412.40",
    rate: null,
    amount: null,
    quantityBasis: "DERIVED",
    selectionBasis: "ENTERED",
    coverage: "COMPLETE",
    source: "S-104 rev B · schedule",
    rule: "rebar-schedule-weight v3",
  },
  {
    itemNo: "3.11",
    description: "Formwork to sides and soffits of footings, incl. props, ties and removal",
    unit: "m²",
    quantity: "186.35",
    rate: "465.00",
    amount: "86652.75",
    quantityBasis: "INTERPRETED",
    selectionBasis: "TRANSCRIBED",
    coverage: "PARTIAL_DECLARED",
    source: "S-118 (raster) rev A · foundation plan",
    omitted: ["stepped-footing risers on F-7 and F-9", "edge formwork to pile-cap junctions"],
    vectorizer: "vec-raster 2.3.1 · 300 DPI",
  },
  {
    itemNo: "3.14",
    description: "Cast-in-situ RCC in shear walls, 1:1.5:3, incl. construction joints",
    unit: "m³",
    quantity: "112.480",
    rate: "9850.00",
    amount: "1107928.00",
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    coverage: "COMPLETE",
    source: "S-203 rev C · plan view",
  },
  {
    itemNo: "3.18",
    description: "Cast-in-situ RCC in pile caps, 1:1.5:3 — thickness not dimensioned on any issued sheet",
    unit: "m³",
    quantity: null,
    rate: "9850.00",
    amount: null,
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    coverage: "COMPLETE",
    source: "S-118 (raster) rev A · foundation plan",
  },
];

/** §6: no grand total under incomplete coverage — a labelled measured-scope subtotal only. */
export const measuredScopeSubtotal = "16744725.75";

export interface ScopeExclusion {
  elementClass: string;
  quantityKind: string;
  cause: RefusalCause;
  /** Human-only causes carry an actor; machine causes carry none (§2). */
  actor: string | null;
  at: string;
  /** §7: the note is never itself the exclusion — the cause is. */
  note: string;
}

export const exclusions: ScopeExclusion[] = [
  {
    elementClass: "pile",
    quantityKind: "concrete",
    cause: "NOT_IN_PROJECT_SCOPE",
    actor: "M. Rahman · responsible surveyor",
    at: "12 Aug 2026",
    note: "Piling let under a separate specialist contract; BoQ preamble cl. 4.2",
  },
  {
    elementClass: "footing",
    quantityKind: "formwork",
    cause: "NOT_ESTABLISHED",
    actor: null,
    at: "13 Aug 2026",
    note: "Uncorroborated interpreted geometry on S-118 — not a line until an act corroborates it",
  },
  {
    elementClass: "stair",
    quantityKind: "concrete",
    cause: "INGESTION_TRUNCATED",
    actor: null,
    at: "13 Aug 2026",
    note: "S-301 exceeded the entity cap at 250,000 — a cap you raise, then re-ingest",
  },
  {
    elementClass: "slab",
    quantityKind: "rebar",
    cause: "ENTITY_TYPE_UNHANDLED",
    actor: null,
    at: "13 Aug 2026",
    note: "Mesh reinforcement drawn as HATCH — the extractor has no reading for it",
  },
];

/** §6: scan-derived geometry discloses by sheet, never by line, and no count of interpreted lines prints. */
export const interpretedDisclosure = {
  sheets: ["S-118", "S-119"],
  statement:
    "All geometry on sheets S-118 and S-119 is machine-interpreted from a raster render (vec-raster 2.3.1, rendered at 300 DPI) and was not read from drawing geometry.",
};

export type QueueKind =
  | "DISCIPLINE"
  | "SCALE"
  | "GEOREFERENCE"
  | "TRANSCRIPTION"
  | "LEVEL_CARRY"
  | "DISCREPANCY"
  | "SCOPE";

export interface QueueItem {
  id: string;
  kind: QueueKind;
  /** What the machine proposes — or the reason it refuses to propose (never a silent default). */
  proposal: string;
  headline: string;
  detail: string;
  /** How many register subjects one act covers — §7: an act is recorded at the granularity performed. */
  subjects: number;
  /** True where nothing downstream can proceed until this is disposed (identity.md §2 fails closed). */
  blocking: boolean;
  source: string;
  /** Judgement, or bookkeeping the surface may batch. */
  weight: "judgement" | "batch";
}

export const queue: QueueItem[] = [
  {
    id: "q-01",
    kind: "DISCIPLINE",
    proposal: "structural — from title block “STRUCTURAL LAYOUT”, 0.94",
    headline: "Confirm discipline · S-118, S-119",
    detail:
      "An unconfirmed drawing is not walked at all. Two sheets are holding the whole foundation package.",
    subjects: 2,
    blocking: true,
    source: "S-118 rev A · title block",
    weight: "judgement",
  },
  {
    id: "q-02",
    kind: "SCALE",
    proposal: "1:100 — 6 views share one calibration family",
    headline: "Affirm scale · foundation-plan family",
    detail:
      "Affirmed once for the family, not once per view — per-view affirmation degenerates into confirm-all.",
    subjects: 6,
    blocking: true,
    source: "S-201/202/203 · plan views",
    weight: "judgement",
  },
  {
    id: "q-03",
    kind: "GEOREFERENCE",
    proposal: "deferred — no lawful bubble evidence in this view",
    headline: "Grid georeference deferred · S-119 detail C",
    detail:
      "Two bubbles readable, three needed for a lawful transform. The machine names the reason instead of guessing an origin.",
    subjects: 1,
    blocking: false,
    source: "S-119 rev A · detail C",
    weight: "judgement",
  },
  {
    id: "q-04",
    kind: "TRANSCRIPTION",
    proposal: "no auto-parse — a note reading is a human act, per sheet",
    headline: "Read the general notes · S-104",
    detail:
      "“CLEAR COVER 40mm UNLESS NOTED” swings every bar on the sheet. A regex parse of this is banned.",
    subjects: 1,
    blocking: false,
    source: "S-104 rev B · general notes",
    weight: "judgement",
  },
  {
    id: "q-05",
    kind: "DISCREPANCY",
    proposal: "no reconciliation proposed — the two sources disagree",
    headline: "Plan places 12 columns; the schedule lists 9 marks",
    detail:
      "C-7, C-8 and C-11 appear on the plan with no schedule row. Measuring all twelve would over-measure — a hard block, never a disclosure.",
    subjects: 3,
    blocking: true,
    source: "S-201 rev C · plan + column schedule",
    weight: "judgement",
  },
  {
    id: "q-06",
    kind: "LEVEL_CARRY",
    proposal: "@unregistered:“ROOF LVL” → carry to L-08 (one hop)",
    headline: "Author the level · “ROOF LVL”",
    detail: "18 register objects are parked on an unregistered label and cannot resolve their level slot.",
    subjects: 18,
    blocking: false,
    source: "S-208 rev A · level datum",
    weight: "batch",
  },
  {
    id: "q-07",
    kind: "TRANSCRIPTION",
    proposal: "94 mark labels read verbatim, awaiting one confirming act",
    headline: "Confirm mark transcription · S-201 column schedule",
    detail: "One act, 94 subjects — recorded at the granularity performed, not as 94 rows of ceremony.",
    subjects: 94,
    blocking: false,
    source: "S-201 rev C · column schedule",
    weight: "batch",
  },
];

/** The absence ledger is the headline, not a footnote — the money is in what has no row. */
export const absenceSummary = {
  cellsTotal: 63,
  cellsWithLines: 41,
  cellsExcluded: 4,
  cellsUnresolved: 18,
};

export const project = {
  name: "Bashundhara R/A Block-K · 14-storey residential",
  drawingSet: "Structural issue rev C · 22 sheets · 2 raster",
  surveyor: "M. Rahman · responsible surveyor",
  bill: "Bill 3 — Concrete works",
};

/**
 * One screen in Bangla (genesis §5). Bangla runs taller than Latin at the same
 * point size and its ascenders hang off the matra, so the type scale carries a
 * separate line-height rather than one shared value.
 */
export const bn = {
  certificate: "পরিমাপকৃত পরিধির সনদ",
  subtotalLabel: "পরিমাপকৃত পরিধির উপ-মোট",
  project: "বসুন্ধরা আবাসিক এলাকা, ব্লক-কে · ১৪ তলা আবাসিক ভবন",
  bill: "বিল ৩ — কংক্রিট কাজ",
  scopeStatement:
    "এই সনদ সম্পূর্ণ কার্যপরিধি দাবি করে না। নিচের তালিকাভুক্ত অংশগুলি পরিমাপ করা হয়নি এবং কারণসহ ঘোষণা করা হয়েছে।",
  disclosure:
    "S-118 ও S-119 শীটের সমস্ত জ্যামিতি রাস্টার রেন্ডার থেকে যন্ত্র-ব্যাখ্যাত (vec-raster 2.3.1, 300 DPI); অঙ্কনের জ্যামিতি থেকে পড়া হয়নি।",
  noGrandTotal: "অসম্পূর্ণ পরিধিতে কোনো সর্বমোট ছাপা হয় না।",
  excludedHeading: "ঘোষিত বর্জন",
  causeLabels: {
    NOT_IN_PROJECT_SCOPE: "প্রকল্পের পরিধির বাইরে",
    NOT_ESTABLISHED: "প্রতিষ্ঠিত নয়",
    NOT_IN_THIS_BILL: "এই বিলে নয়",
    INGESTION_TRUNCATED: "ইনজেশন ছাঁটা হয়েছে",
    ENTITY_TYPE_UNHANDLED: "সত্তার ধরন অপঠিত",
  } satisfies Record<RefusalCause, string>,
  signature: "স্বাক্ষর · দায়িত্বপ্রাপ্ত সার্ভেয়ার",
};
