import { z } from "zod";

/**
 * Zod mirror of the EntityGraph artifact contract. The producer and canonical
 * documentation live at cad/src/vextrus_cad/entitygraph.py; both sides parse
 * the committed fixture, so drift on either side goes red in `pnpm verify`.
 */
export const ENTITYGRAPH_ARTIFACT = "vextrus.entitygraph";
export const ENTITYGRAPH_VERSION = 1;

export const detectedUnitSchema = z.enum([
  "unitless",
  "inch",
  "foot",
  "mm",
  "cm",
  "m",
]);
export type DetectedUnit = z.infer<typeof detectedUnitSchema>;

export const entityGraphSchema = z.object({
  artifact: z.literal(ENTITYGRAPH_ARTIFACT),
  version: z.literal(ENTITYGRAPH_VERSION),
  source: z.object({
    filename: z.string(),
    sha256: z.string().length(64),
  }),
  units: z.object({
    insunits: z.number().int().nullable(),
    detected: detectedUnitSchema.nullable(),
    insunits_unmapped: z.boolean(),
  }),
  counters: z.object({
    original: z.number().int().nonnegative(),
    derived: z.number().int().nonnegative(),
    explode_truncated: z.boolean(),
    lost_by_type: z.record(z.string(), z.number().int().nonnegative()),
  }),
  // Entity shapes are refined per type as ingestion lands (takeoff tickets).
  entities: z.array(z.unknown()),
});

export type EntityGraph = z.infer<typeof entityGraphSchema>;
