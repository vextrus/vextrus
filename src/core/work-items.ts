import type { QuantityDimension, QuantityKind, SiUnit } from "./enums";

/**
 * The work-item catalogue — the **coverage denominator** (measurement-rules.md §4,
 * quantity-contract.md §6: the Certificate of Measured Coverage is a query over work-item
 * catalogue × scope register, never prose). Platform-owned, code-derived at kind grain, keyed on
 * the kind value, and **rate-free by law**: a book item joins *up* to it on the kind, with the
 * unit as the dimension veto. Because the record is keyed on the kind enum, a kind with no
 * catalogue row is unrepresentable rather than tested.
 */

/**
 * A dimension's one canonical SI unit (bd-authority.md §3: SI is the standard, and §68(2) bars
 * keeping any written measurement record in a non-standard unit). One unit per dimension is what
 * lets the unit veto a rate item of the wrong dimension without a second vocabulary to keep in
 * step.
 */
export const DIMENSION_SI_UNIT = {
  LENGTH: "m",
  AREA: "m²",
  VOLUME: "m³",
  MASS: "kg",
  COUNT: "nr",
} as const satisfies Record<QuantityDimension, SiUnit>;

/**
 * The document rounding precisions in force (quantity-contract.md §6: documents round the quantity
 * **before** extension at a per-kind fixed precision, so the printed arithmetic closes on the
 * bill's face; the register keeps full precision and the over-measurement block reads the register
 * value, never the printed one). A code constant, not versioned data: a rounding precision is
 * neither a rate nor a measurement threshold and decides no measured number.
 */
export const DOCUMENT_PRECISIONS = [2, 3] as const;
export type DocumentPrecision = (typeof DOCUMENT_PRECISIONS)[number];

/**
 * A description in one language, carrying whether a native speaker has reviewed it. The flag ships
 * unreviewed and says so: the native-Bengali review this product owes its first client
 * (docs/CONTEXT.md) reviews **strings**, and a string nobody has read is a claim until someone has.
 */
export type CatalogueDescription = { readonly text: string; readonly nativelyReviewed: boolean };

/** What the catalogue carries per kind. No rate, no chapter, no tenant — none of them belong. */
export type WorkItemCatalogueEntry = {
  readonly description: { readonly en: CatalogueDescription; readonly bn: CatalogueDescription };
  readonly dimension: QuantityDimension;
  readonly unit: SiUnit;
  readonly documentPrecision: DocumentPrecision;
};

/**
 * One entry per kind. Both languages from day one, because the boundary statement has to be
 * legible to the person who signs the contract — and the certificate rides in every export
 * channel (quantity-contract.md §6).
 */
export const WORK_ITEM_CATALOGUE = {
  RCC_CONCRETE: {
    description: {
      en: { text: "Reinforced cement concrete, measured on the gross concrete section", nativelyReviewed: false },
      bn: { text: "আরসিসি কংক্রিট, সম্পূর্ণ কংক্রিট সেকশনে পরিমাপকৃত", nativelyReviewed: false },
    },
    dimension: "VOLUME",
    unit: "m³",
    documentPrecision: 3,
  },
  FORMWORK: {
    description: {
      en: { text: "Formwork (shuttering), measured as contact area", nativelyReviewed: false },
      bn: { text: "শাটারিং, সংস্পর্শ ক্ষেত্রফল হিসেবে পরিমাপকৃত", nativelyReviewed: false },
    },
    dimension: "AREA",
    unit: "m²",
    documentPrecision: 2,
  },
  REINFORCEMENT: {
    description: {
      en: { text: "Steel reinforcement, measured by mass", nativelyReviewed: false },
      bn: { text: "রিইনফোর্সমেন্ট রড, ভর হিসেবে পরিমাপকৃত", nativelyReviewed: false },
    },
    dimension: "MASS",
    unit: "kg",
    documentPrecision: 2,
  },
} as const satisfies Record<QuantityKind, WorkItemCatalogueEntry>;
