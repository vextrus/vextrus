/**
 * PROTOTYPE — throwaway fixture. Every row here is real domain content, not
 * lorem ipsum: a refusal with a named cause, a partial-coverage line, an
 * `INTERPRETED` line off a raster sheet, a severed sighting with no bill reach,
 * and a scope register that censuses absence by (class × kind).
 *
 * Sources: quantity-contract.md §2–§6, identity.md §2/§7, formulas.md §6,
 * bd-authority.md §9, src/core/enums.ts.
 *
 * The project is synthetic. No customer, no competitor data (CLAUDE.md).
 */

import type { RefusalCause } from "@/core/enums";
import type { Lang } from "./format";

export type Bi = { en: string; bn: string };

export const t = (s: Bi, lang: Lang) => s[lang];

export const project = {
  name: { en: "Mirpur DOHS — Block C residential", bn: "মিরপুর ডিওএইচএস — ব্লক সি আবাসিক" },
  set: { en: "Structural set S-101…S-108", bn: "কাঠামোগত সেট S-101…S-108" },
  revision: "Rev C",
  taxonomyVersion: "boq-taxonomy@2026.02",
  ruleSet: "measurement-rules@2026.07-3",
};

/** bd-authority.md §9 — six bills, swappable data, en+bn names. */
export const bills: { id: string; name: Bi }[] = [
  { id: "substructure", name: { en: "Substructure", bn: "উপ-কাঠামো" } },
  { id: "superstructure", name: { en: "Superstructure", bn: "উর্ধ্ব-কাঠামো" } },
  { id: "finishes", name: { en: "Finishes", bn: "ফিনিশিং" } },
  { id: "electrical", name: { en: "Electrical", bn: "বৈদ্যুতিক" } },
  { id: "plumbing", name: { en: "Plumbing", bn: "পয়ঃপ্রণালী" } },
  { id: "external", name: { en: "External", bn: "বহিরাঙ্গন" } },
];

export type Coverage = "COMPLETE" | "PARTIAL_DECLARED";
export type Basis = "MEASURED" | "DERIVED" | "INTERPRETED";

export type BillLine = {
  /** register reference — provenance is a reference, never prose (§3). */
  ref: string;
  itemNo: string;
  description: Bi;
  /** the method of measurement *is* the description (§2.1) */
  unit: "m³" | "m²" | "kg" | "nos";
  /** decimal-as-string; the prototype never parses a quantity to a float */
  quantity: string | null;
  dp: number;
  coverage: Coverage;
  basis: Basis;
  /** (drawing, view) — mandatory per-line citation (§3) */
  drawing: string;
  view: Bi;
  ruleId?: string;
  vectorizer?: string;
  /** per-line actor, only where judgement entered (§3) */
  actor?: string;
  /** why the quantity is absent, when it is */
  deferral?: { code: string; note: Bi };
  /** what the partial declaration excludes */
  partialNote?: Bi;
};

export const lines: BillLine[] = [
  {
    ref: "QR-0412",
    itemNo: "3.01",
    description: {
      en: "RCC in columns, 250×500 mm, C1 family, ground floor to level 3, cement concrete (1:1.5:3), including compaction and curing",
      bn: "কলামে আরসিসি, ২৫০×৫০০ মিমি, C1 পরিবার, নিচতলা থেকে লেভেল ৩, সিমেন্ট কংক্রিট (১:১.৫:৩), কম্প্যাকশন ও কিউরিং সহ",
    },
    unit: "m³",
    quantity: "61.2564",
    dp: 3,
    coverage: "COMPLETE",
    basis: "DERIVED",
    drawing: "S-103",
    view: { en: "Column layout plan", bn: "কলাম লেআউট প্ল্যান" },
    ruleId: "col.concrete.prismatic@2",
  },
  {
    ref: "QR-0418",
    itemNo: "3.02",
    description: {
      en: "Formwork to column sides, C2 family, 300×600 mm, levels 4 to 8, contact area measured net",
      bn: "কলামের পার্শ্বে ফর্মওয়ার্ক, C2 পরিবার, ৩০০×৬০০ মিমি, লেভেল ৪ থেকে ৮, নেট কন্টাক্ট এরিয়া",
    },
    unit: "m²",
    quantity: "412.8000",
    dp: 2,
    coverage: "COMPLETE",
    basis: "DERIVED",
    drawing: "S-104",
    view: { en: "Column layout plan", bn: "কলাম লেআউট প্ল্যান" },
    ruleId: "col.formwork.contact@1",
  },
  {
    ref: "QR-0431",
    itemNo: "3.03",
    description: {
      en: "Mild steel reinforcement in columns, cut, bent and placed, main bars and lateral ties",
      bn: "কলামে মাইল্ড স্টিল রিইনফোর্সমেন্ট, কাটা, বাঁকানো ও স্থাপিত, প্রধান বার ও ল্যাটারাল টাই",
    },
    unit: "kg",
    quantity: "124560.400",
    dp: 2,
    coverage: "PARTIAL_DECLARED",
    basis: "DERIVED",
    drawing: "S-107",
    view: { en: "Column schedule", bn: "কলাম শিডিউল" },
    ruleId: "bbs.column.main+tie@4",
    actor: "R. Hasan, MRICS",
    partialNote: {
      en: "Lap lengths are not scheduled on S-107; laps are excluded from this figure and declared.",
      bn: "S-107-এ ল্যাপ দৈর্ঘ্য তফসিলভুক্ত নয়; এই পরিমাণে ল্যাপ অন্তর্ভুক্ত নেই এবং তা ঘোষিত।",
    },
  },
  {
    ref: "QR-0455",
    itemNo: "3.04",
    description: {
      en: "RCC in shear wall SW-2, 200 mm thick, levels 1 to 8",
      bn: "শিয়ার ওয়াল SW-2-এ আরসিসি, ২০০ মিমি পুরু, লেভেল ১ থেকে ৮",
    },
    unit: "m³",
    // "no line is the most expensive defect" (§6): the row survives, the
    // quantity does not.
    quantity: null,
    dp: 3,
    coverage: "COMPLETE",
    basis: "DERIVED",
    drawing: "S-105",
    view: { en: "Wall layout plan", bn: "ওয়াল লেআউট প্ল্যান" },
    deferral: {
      code: "SCALE_UNAFFIRMED",
      note: {
        en: "S-105 carries no affirmed calibration reference. A quantity without one is unrepresentable — the row is published without one and queued.",
        bn: "S-105-এ কোনো নিশ্চিতকৃত স্কেল রেফারেন্স নেই। স্কেল ছাড়া পরিমাণ উপস্থাপনযোগ্য নয় — সারি পরিমাণ ছাড়াই প্রকাশিত ও সারিবদ্ধ।",
      },
    },
  },
  {
    ref: "QR-0471",
    itemNo: "3.05",
    description: {
      en: "RCC in plinth beam PB-1, 250×450 mm, machine-interpreted from raster sheet, corroborated",
      bn: "প্লিন্থ বিম PB-1-এ আরসিসি, ২৫০×৪৫০ মিমি, র‍্যাস্টার শিট থেকে যন্ত্র-ব্যাখ্যাত, সমর্থিত",
    },
    unit: "m³",
    quantity: "18.4400",
    dp: 3,
    coverage: "COMPLETE",
    basis: "INTERPRETED",
    drawing: "S-108",
    view: { en: "Plinth beam plan", bn: "প্লিন্থ বিম প্ল্যান" },
    vectorizer: "vx-raster@0.4.1 · 400 DPI",
    // §3: INTERPRETED carries no per-line actor — machine work is checkable,
    // not believable. The corroboration act is what let it become a line.
  },
];

/**
 * §2 — absence's denominator. Every (element class × quantity kind) cell that
 * produced no line, with a cause. This is a query, never a written table;
 * `NOT_ESTABLISHED` is the fall-through arm and nothing writes it.
 */
export type AbsenceRow = {
  elementClass: string;
  kind: Bi;
  cause: RefusalCause;
  detail: Bi;
};

export const absences: AbsenceRow[] = [
  {
    elementClass: "slab",
    kind: { en: "formwork", bn: "ফর্মওয়ার্ক" },
    cause: "NOT_ESTABLISHED",
    detail: {
      en: "Slabs were sighted; no formwork rule offered a measurement.",
      bn: "স্ল্যাব দেখা গেছে; কোনো ফর্মওয়ার্ক নিয়ম পরিমাপ দেয়নি।",
    },
  },
  {
    elementClass: "beam",
    kind: { en: "reinforcement", bn: "রিইনফোর্সমেন্ট" },
    cause: "INGESTION_TRUNCATED",
    detail: {
      en: "S-106 hit the 500,000-entity cap at 61% of the sheet. Raise the cap and re-ingest.",
      bn: "S-106 শিটের ৬১%-এ ৫,০০,০০০ এনটিটি সীমায় পৌঁছেছে। সীমা বাড়িয়ে পুনরায় ইনজেস্ট করুন।",
    },
  },
  {
    elementClass: "stair",
    kind: { en: "concrete", bn: "কংক্রিট" },
    cause: "ENTITY_TYPE_UNHANDLED",
    detail: {
      en: "Stair flights reached ingestion as a hatch pattern no extractor handles. Nobody wrote this code — this is not a cap you can raise.",
      bn: "সিঁড়ির ফ্লাইট এমন হ্যাচ প্যাটার্ন হিসেবে এসেছে যা কোনো এক্সট্রাক্টর হ্যান্ডল করে না। এই কোড কেউ লেখেনি — এটি বাড়ানোর মতো সীমা নয়।",
    },
  },
];

/** The disposition queue — what a human must decide. */
export type QueueItem = {
  id: string;
  title: Bi;
  cause: string;
  drawing: string;
  subjects: number;
  /** severed objects have no join from any bill (§4, identity.md §2/§7) */
  severed?: boolean;
  detail: Bi;
};

export const queue: QueueItem[] = [
  {
    id: "Q-101",
    title: { en: "Affirm the scale on S-105", bn: "S-105-এ স্কেল নিশ্চিত করুন" },
    cause: "SCALE_UNAFFIRMED",
    drawing: "S-105",
    subjects: 14,
    detail: {
      en: "No calibration reference resolved. 14 shear wall segments hold rows with no quantity until one is affirmed.",
      bn: "কোনো ক্যালিব্রেশন রেফারেন্স মেলেনি। একটি নিশ্চিত না হওয়া পর্যন্ত ১৪টি শিয়ার ওয়াল সেগমেন্ট পরিমাণ ছাড়া থাকবে।",
    },
  },
  {
    id: "Q-104",
    title: {
      en: "Corroborate 26 interpreted stair outlines",
      bn: "২৬টি ব্যাখ্যাত সিঁড়ির আউটলাইন সমর্থন করুন",
    },
    cause: "INTERPRETED_UNCORROBORATED",
    drawing: "S-108",
    subjects: 26,
    detail: {
      en: "Read from a raster render (vx-raster@0.4.1, 400 DPI). Uncorroborated interpreted geometry is never a line — it is a declared exclusion until agreed. Bulk corroboration is lawful and is recorded as one act with 26 subjects.",
      bn: "র‍্যাস্টার রেন্ডার থেকে পঠিত (vx-raster@0.4.1, ৪০০ DPI)। অসমর্থিত ব্যাখ্যাত জ্যামিতি কখনও লাইন নয় — সম্মত না হওয়া পর্যন্ত এটি ঘোষিত বর্জন। গুচ্ছ সমর্থন বৈধ এবং ২৬টি বিষয়সহ একটি কাজ হিসেবে নথিভুক্ত।",
    },
  },
  {
    id: "Q-108",
    title: { en: "Pile cap PC-7 sighted twice", bn: "পাইল ক্যাপ PC-7 দুইবার দেখা গেছে" },
    cause: "DISCIPLINE_NOT_AUTHORITATIVE",
    drawing: "A-201",
    subjects: 1,
    severed: true,
    detail: {
      en: "Sighted from an architectural sheet, which does not own this kind. The object is severed from bill reach: emitting it would assert scope that the structural set does not carry. Over-measurement is a hard block, never a disclosure.",
      bn: "স্থাপত্য শিট থেকে দেখা গেছে, যা এই ধরনের মালিক নয়। বস্তুটি বিল থেকে বিচ্ছিন্ন: এটি প্রকাশ করলে এমন পরিধি দাবি করা হবে যা কাঠামোগত সেটে নেই। অতি-পরিমাপ কঠোরভাবে অবরুদ্ধ, কখনও প্রকাশ নয়।",
    },
  },
  {
    id: "Q-112",
    title: { en: "Raise the entity cap on S-106", bn: "S-106-এ এনটিটি সীমা বাড়ান" },
    cause: "INGESTION_TRUNCATED",
    drawing: "S-106",
    subjects: 1,
    detail: {
      en: "Ingestion stopped at 500,000 entities, 61% through the sheet. Beam reinforcement is absent for this reason and says so.",
      bn: "ইনজেশন ৫,০০,০০০ এনটিটিতে থেমেছে, শিটের ৬১%। এই কারণেই বিম রিইনফোর্সমেন্ট অনুপস্থিত এবং তা বলা হয়েছে।",
    },
  },
];

/** §6 — the certificate. Enumerated and few; no percentage, no line count. */
export const certificate = {
  status: "UNSIGNED" as const,
  surveyor: { en: "R. Hasan, MRICS — not yet signed", bn: "আর. হাসান, MRICS — এখনও স্বাক্ষরিত নয়" },
  rasterSheets: ["S-108"],
  vectorizer: "vx-raster@0.4.1",
  dpi: 400,
  disclosure: {
    en: "All geometry on sheet S-108 is machine-interpreted from a raster render and was not read from drawing geometry.",
    bn: "S-108 শিটের সমস্ত জ্যামিতি একটি র‍্যাস্টার রেন্ডার থেকে যন্ত্র-ব্যাখ্যাত এবং অঙ্কন-জ্যামিতি থেকে পঠিত নয়।",
  },
  refusal: {
    en: "Generation refuses: the boundary is unsigned. It does not refuse on adverse or unknown — those print on the face of the bill.",
    bn: "উৎপাদন প্রত্যাখ্যাত: সীমানা স্বাক্ষরিত নয়। প্রতিকূল বা অজানার কারণে প্রত্যাখ্যান হয় না — সেগুলি বিলের পাতায় ছাপা হয়।",
  },
};

/** Screen-chrome counters. Compact L/Cr is lawful here and nowhere else. */
export const counters = {
  entities: 1_240_000,
  sheets: 8,
  registered: 1_284,
  queued: queue.reduce((n, q) => n + q.subjects, 0),
};
