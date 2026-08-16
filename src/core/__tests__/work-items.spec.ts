import { describe, expect, it } from "vitest";
import { QUANTITY_KINDS } from "@/core/enums";
import { DIMENSION_SI_UNIT, DOCUMENT_PRECISIONS, WORK_ITEM_CATALOGUE } from "@/core/work-items";

/**
 * measurement-rules.md §4 (the catalogue's per-kind content), quantity-contract.md §6 (the fixed
 * document rounding precision), bd-authority.md §3 (SI is the standard). A kind with no catalogue
 * row is unrepresentable — the record is keyed on the kind enum — so nothing tests for one.
 */
describe("the work-item catalogue (measurement-rules.md §4)", () => {
  it("carries both descriptions for every kind, each with its native-review flag", () => {
    for (const kind of QUANTITY_KINDS) {
      const entry = WORK_ITEM_CATALOGUE[kind];
      for (const description of [entry.description.en, entry.description.bn]) {
        expect(description.text.trim().length).toBeGreaterThan(0);
        expect(typeof description.nativelyReviewed).toBe("boolean");
      }
    }
  });
  it("carries a unit that agrees with its dimension (bd-authority.md §3: SI is the standard)", () => {
    for (const kind of QUANTITY_KINDS) {
      const entry = WORK_ITEM_CATALOGUE[kind];
      expect(entry.unit).toBe(DIMENSION_SI_UNIT[entry.dimension]);
    }
  });
  it("carries one fixed document precision per kind — m³ 3 dp, m² 2 dp, kg 2 dp", () => {
    expect(WORK_ITEM_CATALOGUE.RCC_CONCRETE.documentPrecision).toBe(3);
    expect(WORK_ITEM_CATALOGUE.FORMWORK.documentPrecision).toBe(2);
    expect(WORK_ITEM_CATALOGUE.REINFORCEMENT.documentPrecision).toBe(2);
    for (const kind of QUANTITY_KINDS) {
      expect(DOCUMENT_PRECISIONS).toContain(WORK_ITEM_CATALOGUE[kind].documentPrecision);
    }
  });
});
