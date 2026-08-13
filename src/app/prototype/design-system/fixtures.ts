/**
 * PROTOTYPE FIXTURES — ticket 10 (the design system). Not read from a
 * register; shaped like one so the variants aren't judged on lorem ipsum.
 * Values follow docs/domain/quantity-contract.md §1 (basis/coverage) and
 * §6 (the certificate, the interpreted-sheet disclosure, no compact money).
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

export interface BillLine {
  mark: string;
  elementType: string;
  kind: string;
  unit: string;
  quantity: string;
  rate: string | null; // null: an item-selecting attribute is missing — publish unpriced
  amount: string | null;
  quantityBasis: BasisValue;
  selectionBasis: BasisValue;
  coverage: Coverage;
  drawing: string;
}

export const billLines: BillLine[] = [
  {
    mark: "C-14",
    elementType: "column",
    kind: "concrete",
    unit: "m³",
    quantity: "4.320",
    rate: "9500.00",
    amount: "41040.00",
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    coverage: "COMPLETE",
    drawing: "S-101 rev C",
  },
  {
    mark: "TB-2",
    elementType: "tie_grade_beam",
    kind: "rebar",
    unit: "kg",
    quantity: "612.40",
    rate: null,
    amount: null,
    quantityBasis: "DERIVED",
    selectionBasis: "DERIVED",
    coverage: "COMPLETE",
    drawing: "S-101 rev C",
  },
  {
    mark: "F-3",
    elementType: "footing",
    kind: "formwork",
    unit: "m²",
    quantity: "18.60",
    rate: "420.00",
    amount: "7812.00",
    quantityBasis: "INTERPRETED",
    selectionBasis: "INTERPRETED",
    coverage: "PARTIAL_DECLARED",
    drawing: "S-104 (scan) rev A",
  },
  {
    mark: "SW-1",
    elementType: "shear_wall",
    kind: "concrete",
    unit: "m³",
    quantity: "22.150",
    rate: "9500.00",
    amount: "210425.00",
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    coverage: "COMPLETE",
    drawing: "S-102 rev B",
  },
];

export const exclusion = {
  elementClass: "pile_cap",
  kind: "rebar",
  cause: "NOT_IN_PROJECT_SCOPE" as const,
  actor: "M. Rahman, QS",
  note: "Piling under separate specialist contract per BoQ preamble cl. 4.2",
};

export const interpretedDisclosure = {
  sheets: ["S-104"],
  vectorizerId: "raster-vec",
  vectorizerVersion: "2.3.1",
  dpi: 300,
  statement:
    "All geometry on sheet S-104 is machine-interpreted from a raster render (raster-vec v2.3.1, 300 DPI) and was not read from drawing geometry.",
};

// A headline number large enough to exercise the crore group, never rounded
// to a compact "Cr" on a document (quantity-contract.md §6).
export const measuredScopeSubtotal = "12345678.00";

export const banglaScreen = {
  heading: "পরিমাপনসহ সংরক্ষণের সনদ", // "Certificate of Measured Coverage"
  subtotalLabel: "পরিমাপিত-সীমা উপয়োগ", // "Measured-scope subtotal"
  statement:
    "এই সনদটি সম্পূর্ণ কার্যপরিধি দাবি করে না—শুধু পরিমাপিত অংশটুকু।", // "This certificate does not claim full coverage — only the measured part."
};
