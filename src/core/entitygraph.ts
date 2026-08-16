import { z } from "zod";

/**
 * Zod mirror of the EntityGraph artifact contract. The producer and canonical
 * documentation live at cad/src/vextrus_cad/entitygraph.py; both sides parse
 * the committed fixtures, so drift on either side goes red in `pnpm verify`.
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

const pointSchema = z.tuple([z.number(), z.number()]);
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/, "resolved #rrggbb");

// Common fields: `src` null marks an original entity (which must carry its
// DXF handle — enforced below); a set `src` cites the originating original.
const base = {
  h: z.string().nullable(),
  layer: z.string(),
  color: colorSchema,
  src: z.string().nullable(),
};

// Closed paths carry their shoelace area; open paths carry null (enforced below).
const pathFields = {
  pts: z.array(pointSchema).min(2),
  closed: z.boolean(),
  area: z.number().nonnegative().nullable(),
};

const textFields = {
  text: z.string(),
  p: pointSchema,
  // World height, never screen size (cad-ingestion.md §4).
  height: z.number().nonnegative(),
  rot: z.number(),
};

const attrSchema = z.object({
  tag: z.string(),
  text: z.string(),
  p: pointSchema,
  height: z.number().nonnegative(),
});

export const entitySchema = z
  .discriminatedUnion("t", [
    z.object({ t: z.literal("LINE"), ...base, p1: pointSchema, p2: pointSchema }),
    z.object({ t: z.literal("LWPOLYLINE"), ...base, ...pathFields }),
    z.object({ t: z.literal("POLYLINE"), ...base, ...pathFields }),
    z.object({ t: z.literal("SOLID"), ...base, ...pathFields }),
    z.object({ t: z.literal("CIRCLE"), ...base, c: pointSchema, r: z.number().nonnegative() }),
    z.object({
      t: z.literal("ARC"),
      ...base,
      c: pointSchema,
      r: z.number().nonnegative(),
      a1: z.number(),
      a2: z.number(),
    }),
    z.object({ t: z.literal("TEXT"), ...base, ...textFields }),
    z.object({ t: z.literal("MTEXT"), ...base, ...textFields }),
    z.object({
      t: z.literal("INSERT"),
      ...base,
      name: z.string(),
      p: pointSchema,
      attrs: z.array(attrSchema),
    }),
    // DIMENSION carries provenance only; its rendered geometry (measurement
    // text included) arrives as derived entities citing this handle (§3).
    z.object({ t: z.literal("DIMENSION"), ...base }),
  ])
  .superRefine((e, ctx) => {
    if (e.src === null && !e.h) {
      ctx.addIssue({
        code: "custom",
        message: "an original entity must carry its DXF handle",
      });
    }
    if ("closed" in e && e.closed !== (e.area !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "a closed path carries its area; an open path carries null",
      });
    }
  });
export type Entity = z.infer<typeof entitySchema>;

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
    unsupported_by_type: z.record(z.string(), z.number().int().nonnegative()),
  }),
  entities: z.array(entitySchema),
});

export type EntityGraph = z.infer<typeof entityGraphSchema>;
