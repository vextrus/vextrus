import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  actTypes,
  disciplines,
  elementTypes,
  ingestJobStatuses,
  ingestStatuses,
  levelBases,
  refusalCauses,
  type ActType,
  type Discipline,
  type ElementType,
  type IngestJobStatus,
  type IngestStatus,
  type LevelBasis,
  type RefusalCause,
} from "../../src/core/enums";
import {
  detectedUnitSchema,
  type DetectedUnit,
} from "../../src/core/entitygraph";

/** The artifact's own closed unit vocabulary is the column's CHECK source. */
const detectedUnits = detectedUnitSchema.options;

/**
 * Spine tables, skeleton grade (genesis §7.4). The register lands with the
 * first module tickets; tenancy lands here because the seam and RLS must
 * exist before any tenant-owned row does.
 */

/**
 * tenants/users/memberships are better-auth managed (genesis §4): the org
 * plugin maps organization→tenants and member→memberships (src/core/auth.ts),
 * so auth and the tenant seam share one model — no sync, no special cases.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId)],
);

/**
 * CHECK derived from the enum const (ADR-0002): the TS const is the single
 * declaration site; the constraint is its emission. sql.raw keeps the DDL
 * deterministic for drizzle-kit.
 */
function enumCheck(name: string, column: string, values: readonly string[]) {
  return check(
    name,
    sql.raw(`"${column}" in (${values.map((v) => `'${v}'`).join(", ")})`),
  );
}

/* ------------------------------------------------------------------------- *
 * The register spine (ADR-0005, docs/domain/identity.md). Every table below
 * is tenant-owned: tenant_id + the db/rls.ts block in its migration, reached
 * only through the seam (ADR-0004).
 *
 * FK validation bypasses RLS, so every parent reference is a composite FK
 * carrying tenant_id (or project_id, where the identity key demands
 * project-consistency) against a (parent id, scope) unique pair — a child row
 * citing another tenant's parent, or a level from another project, is refused
 * by the database, not by convention. Review-confirmed live before this
 * shape: a cross-tenant insert into drawing_revisions.
 * ------------------------------------------------------------------------- */

/**
 * The project record (identity.md §8): pins config as a precondition of
 * campaign creation. Pins are opaque references until the book/rules modules
 * land — NULL means "not yet pinned", and campaign creation (future) refuses
 * on it; there is no default edition.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    pinnedBookEdition: text("pinned_book_edition"),
    pinnedRuleSet: text("pinned_rule_set"),
    pinnedMultiplierScheme: text("pinned_multiplier_scheme"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("projects_tenant_idx").on(t.tenantId),
    // pair target for children's composite FKs
    unique("projects_id_tenant_uq").on(t.id, t.tenantId),
  ],
);

/**
 * The level stack (identity.md §2): referenced everywhere by surrogate id.
 * label, ordinal and height are non-identifying and correctable — none of
 * them appears in any key or unique constraint, so a rename can never re-key
 * the ledger.
 */
export const levels = pgTable(
  "levels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    label: text("label").notNull(),
    ordinal: integer("ordinal").notNull(),
    heightMm: numeric("height_mm"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("levels_project_idx").on(t.projectId),
    unique("levels_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "levels_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
  ],
);

/**
 * Discipline is drawing-scoped, machine-proposed, human-confirmed, and fails
 * closed (identity.md §2): `discipline` NULL means unconfirmed, and an
 * unconfirmed drawing is not walked at all. Confirmation is a human act
 * (DISCIPLINE_CONFIRMED); this column is the materialised state beside it.
 */
export const drawings = pgTable(
  "drawings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    disciplineProposed: text("discipline_proposed").$type<Discipline>(),
    discipline: text("discipline").$type<Discipline>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drawings_project_idx").on(t.projectId),
    unique("drawings_id_tenant_uq").on(t.id, t.tenantId),
    // pair target for the revision chain's project-carrying FKs
    unique("drawings_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "drawings_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    enumCheck("drawings_discipline_proposed_ck", "discipline_proposed", disciplines),
    enumCheck("drawings_discipline_ck", "discipline", disciplines),
  ],
);

/**
 * A drawing revision: one uploaded source file, immutable once landed. seq is
 * assigned at upload and never reassigned — registration order, not a
 * correctable attribute. The DB stores the file reference + sha256, never the
 * blob (ticket 04 guardrail).
 *
 * project_id is carried (not just reachable through the drawing) so that every
 * row downstream of a revision can be project-paired by FK — evidence must not
 * be citable across projects inside one tenant.
 */
export const drawingRevisions = pgTable(
  "drawing_revisions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    seq: integer("seq").notNull(),
    sourceFilename: text("source_filename").notNull(),
    sourceRef: text("source_ref").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drawing_revisions_drawing_idx").on(t.drawingId),
    unique("drawing_revisions_id_tenant_uq").on(t.id, t.tenantId),
    unique("drawing_revisions_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "drawing_revisions_drawing_tenant_fk",
      columns: [t.drawingId, t.tenantId],
      foreignColumns: [drawings.id, drawings.tenantId],
    }),
    foreignKey({
      name: "drawing_revisions_drawing_project_fk",
      columns: [t.drawingId, t.projectId],
      foreignColumns: [drawings.id, drawings.projectId],
    }),
    unique("drawing_revisions_drawing_seq_uq").on(t.drawingId, t.seq),
    check("drawing_revisions_seq_ck", sql.raw(`"seq" >= 1`)),
  ],
);

/**
 * One ingestion run of a revision through the cad pipeline. Fidelity counters
 * mirror the EntityGraph artifact's counters block verbatim (cad-ingestion.md
 * §3; surfacing truncation is mandatory — quantity-contract §2). CHECKs make
 * the two silent states unrepresentable: a "succeeded" ingest without real
 * counters, and a "failed" one without a named error.
 */
export const ingests = pgTable(
  "ingests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    drawingRevisionId: uuid("drawing_revision_id").notNull(),
    status: text("status").$type<IngestStatus>().notNull().default("pending"),
    /** EntityGraph artifact reference (filesystem path for now) + hash. */
    artifactRef: text("artifact_ref"),
    artifactSha256: text("artifact_sha256"),
    entitiesOriginal: integer("entities_original"),
    entitiesDerived: integer("entities_derived"),
    explodeTruncated: boolean("explode_truncated"),
    lostByType: jsonb("lost_by_type").$type<Record<string, number>>(),
    /**
     * Entity types the extractor has no code for (cad-ingestion.md §3) — a
     * different species of loss from `lost_by_type` (a cap that tripped), and
     * the register's ENTITY_TYPE_UNHANDLED evidence. Counted, never dropped.
     */
    unsupportedByType: jsonb("unsupported_by_type").$type<
      Record<string, number>
    >(),
    insunits: integer("insunits"),
    unitDetected: text("unit_detected").$type<DetectedUnit>(),
    insunitsUnmapped: boolean("insunits_unmapped"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("ingests_revision_idx").on(t.drawingRevisionId),
    unique("ingests_id_tenant_uq").on(t.id, t.tenantId),
    unique("ingests_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "ingests_revision_tenant_fk",
      columns: [t.drawingRevisionId, t.tenantId],
      foreignColumns: [drawingRevisions.id, drawingRevisions.tenantId],
    }),
    foreignKey({
      name: "ingests_revision_project_fk",
      columns: [t.drawingRevisionId, t.projectId],
      foreignColumns: [drawingRevisions.id, drawingRevisions.projectId],
    }),
    enumCheck("ingests_status_ck", "status", ingestStatuses),
    enumCheck("ingests_unit_detected_ck", "unit_detected", detectedUnits),
    check(
      "ingests_succeeded_ck",
      sql.raw(
        `"status" <> 'succeeded' or ("artifact_ref" is not null and "artifact_sha256" is not null and "entities_original" is not null and "entities_derived" is not null and "explode_truncated" is not null and "lost_by_type" is not null and "unsupported_by_type" is not null and "insunits_unmapped" is not null and "error" is null)`,
      ),
    ),
    check(
      "ingests_failed_ck",
      sql.raw(`"status" <> 'failed' or "error" is not null`),
    ),
  ],
);

/**
 * The ingest queue (ADR-0009): a plain table claimed with
 * `FOR UPDATE SKIP LOCKED`, in this repo's one migration lane. One job per
 * ingest — a re-run is a new ingest, so the evidence row and the work that
 * produced it stay one-to-one.
 *
 * `locked_at` is a lease, not a lock: a worker that dies mid-job leaves a
 * `running` row, and the claim query reclaims it once the lease expires,
 * bumping `attempts`. A job whose attempts exceed the cap fails with a named
 * error rather than looping forever — an invisible retry loop is silence.
 */
export const ingestJobs = pgTable(
  "ingest_jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    status: text("status")
      .$type<IngestJobStatus>()
      .notNull()
      .default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // the claim query's index: oldest claimable job first
    index("ingest_jobs_claim_idx").on(t.status, t.createdAt),
    unique("ingest_jobs_ingest_uq").on(t.ingestId),
    foreignKey({
      name: "ingest_jobs_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    foreignKey({
      name: "ingest_jobs_ingest_project_fk",
      columns: [t.ingestId, t.projectId],
      foreignColumns: [ingests.id, ingests.projectId],
    }),
    enumCheck("ingest_jobs_status_ck", "status", ingestJobStatuses),
    check(
      "ingest_jobs_failed_ck",
      sql.raw(`"status" <> 'failed' or "error" is not null`),
    ),
    check("ingest_jobs_attempts_ck", sql.raw(`"attempts" >= 0`)),
  ],
);

/**
 * The Quantity Register's object table. Identity is the sextuple
 * (project, discipline, level, element type, mark, ordinal) — identity.md §2.
 * The level slot is a surrogate id or a lawful null naming its basis
 * (FOUNDATION / UNRESOLVED — §3); NULLS NOT DISTINCT makes the unique
 * constraint hold for level-null identities too. The constraint IS the
 * double-count guard; ordinal freezes at first registration (§4).
 */
export const registerObjects = pgTable(
  "register_objects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    discipline: text("discipline").$type<Discipline>().notNull(),
    levelId: uuid("level_id"),
    levelBasis: text("level_basis").$type<LevelBasis>().notNull(),
    elementType: text("element_type").$type<ElementType>().notNull(),
    mark: text("mark").notNull(),
    ordinal: integer("ordinal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("register_objects_identity_uq")
      .on(t.projectId, t.discipline, t.levelId, t.levelBasis, t.elementType, t.mark, t.ordinal)
      .nullsNotDistinct(),
    unique("register_objects_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "register_objects_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    // the identity key demands the level belong to the same project — a
    // level id from a sibling project would corrupt the key silently
    foreignKey({
      name: "register_objects_level_project_fk",
      columns: [t.levelId, t.projectId],
      foreignColumns: [levels.id, levels.projectId],
    }),
    enumCheck("register_objects_discipline_ck", "discipline", disciplines),
    enumCheck("register_objects_element_type_ck", "element_type", elementTypes),
    enumCheck("register_objects_level_basis_ck", "level_basis", levelBases),
    check(
      "register_objects_level_slot_ck",
      sql.raw(`("level_basis" = 'LEVEL') = ("level_id" is not null)`),
    ),
    check("register_objects_ordinal_ck", sql.raw(`"ordinal" >= 1`)),
  ],
);

/**
 * A sighting that landed ON the register: the placement that registered a
 * register object, kept beside it rather than inside it (identity.md §3 — the
 * placement key quantizes world coordinates, and **no coordinate may enter an
 * identity key**). Two things hang on this table:
 *
 * - **Idempotency.** A second registration pass over the same drawing offers
 *   the same content-derived placement keys, which are already here, so the
 *   pass is a no-op — not a wall of duplicate refusals. The unique key is
 *   (project, drawing, placement key): the key's own view part is a DXF handle,
 *   which is stable within one file and meaningless across two.
 * - **Provenance.** The originals a registration cited (cad-ingestion.md §2),
 *   with the ingest that produced them.
 *
 * Append-only on the app lane, like every other piece of evidence.
 */
export const registerObjectSightings = pgTable(
  "register_object_sightings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    registerObjectId: uuid("register_object_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    /** Placement key (identity.md §3): view key + mark + quantized coordinates. */
    placementKey: text("placement_key").notNull(),
    viewKey: text("view_key").notNull(),
    /** DXF handles cited as evidence — provenance, never identity. */
    handles: jsonb("handles").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("register_object_sightings_object_idx").on(t.registerObjectId),
    unique("register_object_sightings_placement_uq").on(
      t.projectId,
      t.drawingId,
      t.placementKey,
    ),
    foreignKey({
      name: "register_object_sightings_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    foreignKey({
      name: "register_object_sightings_object_project_fk",
      columns: [t.registerObjectId, t.projectId],
      foreignColumns: [registerObjects.id, registerObjects.projectId],
    }),
    foreignKey({
      name: "register_object_sightings_drawing_project_fk",
      columns: [t.drawingId, t.projectId],
      foreignColumns: [drawings.id, drawings.projectId],
    }),
    foreignKey({
      name: "register_object_sightings_ingest_project_fk",
      columns: [t.ingestId, t.projectId],
      foreignColumns: [ingests.id, ingests.projectId],
    }),
  ],
);

/** The refused sighting's evidence payload: attempted identity + cited DXF handles. */
export type RefusedSightingSubject = {
  identity: {
    discipline: Discipline | null;
    levelId: string | null;
    levelBasis: LevelBasis | null;
    elementType: ElementType | null;
    mark: string | null;
    ordinal: number | null;
  };
  /** DXF entity handles cited as evidence (cad-ingestion.md §2). */
  handles: string[];
};

/**
 * Unpriceable evidence, in its own table (identity.md §2): a refused sighting
 * never sits on the register with a status flag — one forgotten WHERE from
 * over-measurement. No bill table may ever join here. registerObjectId points
 * AT the register (the row a DUPLICATE_IDENTITY duplicated), never from it.
 */
export const refusedSightings = pgTable(
  "refused_sightings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    ingestId: uuid("ingest_id"),
    registerObjectId: uuid("register_object_id"),
    cause: text("cause").$type<RefusalCause>().notNull(),
    subject: jsonb("subject").$type<RefusedSightingSubject>().notNull(),
    /** Context only — never itself the exclusion (identity.md §7). */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("refused_sightings_project_idx").on(t.projectId),
    foreignKey({
      name: "refused_sightings_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    // project-paired, not merely tenant-paired: a same-tenant sighting citing
    // a sibling project's ingest as evidence would otherwise pass. The ingest's
    // own project_id is tenant-anchored up the revision chain, so this FK
    // subsumes the tenant pairing it replaces (ticket 04 review finding).
    foreignKey({
      name: "refused_sightings_ingest_project_fk",
      columns: [t.ingestId, t.projectId],
      foreignColumns: [ingests.id, ingests.projectId],
    }),
    foreignKey({
      name: "refused_sightings_object_project_fk",
      columns: [t.registerObjectId, t.projectId],
      foreignColumns: [registerObjects.id, registerObjects.projectId],
    }),
    enumCheck("refused_sightings_cause_ck", "cause", refusalCauses),
  ],
);

/** An act's subject reference, at the granularity performed (one act, N subjects). */
export type ActSubject = {
  kind:
    | "project"
    | "level"
    | "drawing"
    | "drawing_revision"
    | "ingest"
    | "register_object"
    | "refused_sighting";
  id: string;
};

/**
 * The act log (identity.md §7): append-only, human-only. The RLS migration
 * grants the app role SELECT and INSERT only — UPDATE/DELETE do not exist on
 * any request path. An audit trail beside materialised state, not an event
 * source. Machine authorship needs no log.
 */
export const acts = pgTable(
  "acts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    /**
     * Global users FK only — membership of the tenant is checked at the seam
     * (withAct), because an FK onto memberships would make offboarding a user
     * impossible once they had ever acted.
     */
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    actType: text("act_type").$type<ActType>().notNull(),
    subjects: jsonb("subjects").$type<ActSubject[]>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("acts_project_idx").on(t.projectId),
    foreignKey({
      name: "acts_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    enumCheck("acts_act_type_ck", "act_type", actTypes),
  ],
);
