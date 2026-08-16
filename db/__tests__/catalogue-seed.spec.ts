import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BEARS_PAIRS } from "@/core/kinds";
import { compareCanonical } from "@/core/order";
import { WORK_ITEM_CATALOGUE, type WorkItemCatalogueEntry } from "@/core/work-items";
import type { QuantityKind } from "@/core/enums";

/**
 * The seed-row guard (measurement-rules.md §4, 2026-08-16: the work-item catalogue and `bears`
 * are emitted as tables by migration, with a stage in `pnpm verify` failing when table and const
 * disagree). The schema-drift probe covers the DDL and only the DDL — drizzle-kit generates
 * `CREATE TABLE`, never `INSERT` — so the rows need their own guard, and this file is it.
 *
 * **This is the one place that knows the emitted SQL's shape.** That is the accepted cost of a
 * check that needs no database and no new verify stage: it renders the rows the consts imply and
 * asserts the block appears verbatim in a committed migration. A landed migration is never
 * edited, so a const edit is answered by a *new* migration carrying the whole block — the block
 * re-seeds (delete, then insert) precisely so that superseding is the same paste, not a diff
 * somebody hand-computes.
 */

const MIGRATIONS = path.resolve(import.meta.dirname, "../migrations");
const BREAK = "--> statement-breakpoint";

/** SQL string literal: the one escape a seeded row needs, and Bengali passes through as text. */
function lit(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function catalogueRow(kind: QuantityKind, entry: WorkItemCatalogueEntry): string {
  const { en, bn } = entry.description;
  return `\t(${[
    lit(kind),
    lit(en.text),
    String(en.nativelyReviewed),
    lit(bn.text),
    String(bn.nativelyReviewed),
    lit(entry.dimension),
    lit(entry.unit),
    String(entry.documentPrecision),
  ].join(", ")})`;
}

/**
 * The rows as SQL, canonically ordered (order.ts is the identity comparator, and a seed block
 * whose row order drifted with `Object.keys` would fail this guard for no semantic change).
 */
function catalogueSeedSql(): string {
  const catalogue = Object.entries(WORK_ITEM_CATALOGUE)
    .sort(([a], [b]) => compareCanonical(a, b))
    .map(([kind, entry]) => catalogueRow(kind as QuantityKind, entry));
  const bears = [...BEARS_PAIRS]
    .map((p) => `\t(${lit(p.elementType)}, ${lit(p.kind)})`)
    .sort(compareCanonical);
  return [
    `DELETE FROM "bears";${BREAK}`,
    `DELETE FROM "work_item_catalogue";${BREAK}`,
    `INSERT INTO "work_item_catalogue" ("kind", "description_en", "description_en_natively_reviewed", "description_bn", "description_bn_natively_reviewed", "dimension", "unit", "document_precision") VALUES`,
    `${catalogue.join(",\n")};${BREAK}`,
    `INSERT INTO "bears" ("element_type", "kind") VALUES`,
    `${bears.join(",\n")};`,
  ].join("\n");
}

describe("the catalogue and bears seed rows (measurement-rules.md §4)", () => {
  it("are carried verbatim by a committed migration", () => {
    const block = catalogueSeedSql();
    const carriers = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => readFileSync(path.join(MIGRATIONS, f), "utf8").includes(block));
    expect(
      carriers,
      `No migration under db/migrations/ carries the vocabulary's rows. A kind, a description, a` +
        ` unit, a precision or a \`bears\` pair changed in src/core/, and the tables the residue and` +
        ` the certificate query would now disagree with the consts.\n\nRemedy: create the next` +
        ` migration (never edit a landed one) and paste this block into it, ending with a` +
        ` \`${BREAK}\` if anything follows:\n\n${block}\n`,
    ).not.toHaveLength(0);
  });
});
