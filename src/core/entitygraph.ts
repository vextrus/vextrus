import { z } from "zod";

/**
 * Zod mirror of the EntityGraph artifact contract. The producer and canonical
 * documentation live at cad/src/vextrus_cad/entitygraph.py; both sides parse
 * the committed fixtures, so drift on either side goes red in `pnpm verify`.
 *
 * Version 2 (ADR-0009, cad-ingestion.md §4's amendment of 2026-08-16) carries the four facts
 * the app can never recover, because the CLI is one-shot and nothing here may re-open the
 * drawing: a space marker per entity, the layout inventory with its content-less drop count,
 * the robust extents with the count the percentile window rejected, and the flatten point-cap
 * counter. Purely additive: no v1 field changed meaning and keys are DXF handles, untouched.
 */
export const ENTITYGRAPH_ARTIFACT = "vextrus.entitygraph";
export const ENTITYGRAPH_VERSION = 2;

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
const bboxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(
    ([minX, minY, maxX, maxY]) => minX <= maxX && minY <= maxY,
    "[minx, miny, maxx, maxy]",
  );

/**
 * The space an entity was drawn in (cad-ingestion.md §7 opens "every model-space original
 * entity"). Model space is the reserved token `model`; a paper layout is its DXF name behind
 * `paper:` — a DXF layout name cannot carry `:`, so the two can never collide.
 */
export const SPACE_MODEL = "model";
export const PAPER_SPACE_PREFIX = "paper:";
export const spaceSchema = z
  .string()
  .refine(
    (v) =>
      v === SPACE_MODEL ||
      (v.startsWith(PAPER_SPACE_PREFIX) &&
        v.length > PAPER_SPACE_PREFIX.length),
    `"${SPACE_MODEL}" or "${PAPER_SPACE_PREFIX}<layout name>"`,
  );
export type Space = z.infer<typeof spaceSchema>;

/** The layout a space marker names, or null for model space. */
export function layoutOf(space: Space): string | null {
  return space.startsWith(PAPER_SPACE_PREFIX)
    ? space.slice(PAPER_SPACE_PREFIX.length)
    : null;
}

// Common fields: `src` null marks an original entity (which must carry its
// DXF handle — enforced below); a set `src` cites the originating original.
const base = {
  h: z.string().nullable(),
  layer: z.string(),
  color: colorSchema,
  space: spaceSchema,
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
    z.object({
      t: z.literal("LINE"),
      ...base,
      p1: pointSchema,
      p2: pointSchema,
    }),
    z.object({ t: z.literal("LWPOLYLINE"), ...base, ...pathFields }),
    z.object({ t: z.literal("POLYLINE"), ...base, ...pathFields }),
    z.object({ t: z.literal("SOLID"), ...base, ...pathFields }),
    z.object({
      t: z.literal("CIRCLE"),
      ...base,
      c: pointSchema,
      r: z.number().nonnegative(),
    }),
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

export const entityGraphSchema = z
  .object({
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
    // Robust extents over model space (§4): the bbox, and the count of entities the 2nd-98th
    // inter-percentile window rejected as stray. Null bbox means the drawing carried no geometry
    // — never a zero-size box at the origin.
    extents: z.object({
      bbox: bboxSchema.nullable(),
      rejected: z.number().int().nonnegative(),
    }),
    // §4: paper layouts get their own bbox and content-less layouts are dropped — counted here,
    // because a drop nobody counted is the silent loss §3 forbids.
    layouts: z.object({
      paper: z.array(
        z.object({
          name: z
            .string()
            .min(1)
            .refine((n) => !n.includes(":"), "a layout name carries no ':'"),
          bbox: bboxSchema.nullable(),
        }),
      ),
      dropped_contentless: z.number().int().nonnegative(),
    }),
    counters: z.object({
      original: z.number().int().nonnegative(),
      derived: z.number().int().nonnegative(),
      explode_truncated: z.boolean(),
      // Curves flatten at fixed tolerance under a point cap (§4); unlike `explode_truncated`, a
      // tripped cap said nothing at v1.
      flatten_capped: z.number().int().nonnegative(),
      lost_by_type: z.record(z.string(), z.number().int().nonnegative()),
      unsupported_by_type: z.record(z.string(), z.number().int().nonnegative()),
    }),
    entities: z.array(entitySchema),
  })
  .superRefine((graph, ctx) => {
    const shipped = new Set(graph.layouts.paper.map((l) => l.name));
    if (shipped.size !== graph.layouts.paper.length) {
      ctx.addIssue({
        code: "custom",
        path: ["layouts", "paper"],
        message: "a layout is listed twice",
      });
    }
    graph.entities.forEach((e, i) => {
      const layout = layoutOf(e.space);
      // An entity in a layout the inventory dropped would make `dropped_contentless` a lie.
      if (layout !== null && !shipped.has(layout)) {
        ctx.addIssue({
          code: "custom",
          path: ["entities", i, "space"],
          message: `names layout "${layout}", absent from layouts.paper`,
        });
      }
    });
  });

export type EntityGraph = z.infer<typeof entityGraphSchema>;
