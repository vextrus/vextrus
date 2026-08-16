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
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACT_TYPES,
  DISCIPLINES,
  ELEMENT_TYPES,
  LEVEL_BASES,
  LEVEL_HEIGHT_BASES,
  REFUSED_SIGHTING_CAUSES,
} from "../../src/core/enums";
import { MODEL_IDS, REFUSAL_CAUSES } from "../../src/core/model";
import { tenantIsolation } from "./rls";

/**
 * The spine, skeleton grade (ADR-0005). Tenancy lands here because the seam and RLS must exist
 * before any tenant-owned row does; the register lands with the first takeoff ticket, citing
 * docs/domain/identity.md. Every tenant-owned table carries `tenant_id` and gets the
 * `tenantIsolation` policy from ./rls.ts (ADR-0004).
 *
 * FK validation bypasses RLS, so a child's parent reference is a composite FK carrying
 * tenant_id against a (parent id, tenant_id) unique pair — a child citing another tenant's
 * parent is refused by the database, not by convention.
 */

/**
 * CHECK derived from a TS const (ADR-0002): the const is the single declaration site; the
 * constraint is its emission. sql.raw keeps the DDL deterministic for drizzle-kit.
 */
function enumCheck(name: string, column: string, values: readonly string[]) {
  return check(name, sql.raw(`"${column}" in (${values.map((v) => `'${v}'`).join(", ")})`));
}

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A B2C user is a single-member tenant: one model, no special cases (ADR-0004). */
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId), tenantIsolation("memberships")],
).enableRLS();

/**
 * The project record (identity.md §8): pins configuration as a precondition of campaign
 * creation. Pins are opaque references until the book and rule-set modules land — NULL means
 * "not yet pinned", and campaign creation refuses on it; there is no default edition.
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_tenant_idx").on(t.tenantId),
    // pair target for children's composite FKs
    unique("projects_id_tenant_uq").on(t.id, t.tenantId),
    tenantIsolation("projects"),
  ],
).enableRLS();

/**
 * The model call ledger (ADR-0006): one row per call through `callModel`, proposed or refused,
 * attributed to a tenant. Append-only by grant (INSERT and SELECT only for the app role). It is
 * not the act log — a model call is machine work, and identity.md §7 keeps the act log
 * human-only; a human act that relies on a proposal cites the call by id.
 */
export const modelCalls = pgTable(
  "model_calls",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id"),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(),
    requestHash: text("request_hash").notNull(),
    transport: text("transport").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    outcome: text("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("model_calls_tenant_idx").on(t.tenantId),
    enumCheck("model_calls_model_check", "model", MODEL_IDS),
    enumCheck("model_calls_transport_check", "transport", ["live", "fixture"]),
    enumCheck("model_calls_outcome_check", "outcome", ["PROPOSED", ...REFUSAL_CAUSES]),
    foreignKey({
      name: "model_calls_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    tenantIsolation("model_calls"),
  ],
).enableRLS();

// ---------------------------------------------------------------------------------------------
// The register spine, skeleton grade (identity.md §1–§3, §7, §9; ADR-0005). Identity tables only:
// nothing here measures anything. Every table is tenant-owned (RLS + composite FKs, ADR-0004) and
// project-scoped, and every child cites its parent by a composite (id, project_id) or
// (id, tenant_id) pair, so a row can never point at another tenant's or project's parent.
// ---------------------------------------------------------------------------------------------

/**
 * A level (identity.md §2, measurement-rules.md §7): a project-scoped object referenced by
 * surrogate id. Label, ordinal and height are non-identifying — a rename never re-keys the
 * ledger. The ordinal is physical (per-floor rollups and multiplier schemes key to it, never to
 * a label). A storey height carries its basis; DEFAULTED is barred, so a height without a basis
 * or a basis without a height is unrepresentable.
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
    height: numeric("height"),
    heightBasis: text("height_basis"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("levels_project_idx").on(t.projectId),
    unique("levels_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "levels_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    enumCheck("levels_height_basis_check", "height_basis", LEVEL_HEIGHT_BASES),
    check("levels_height_with_basis_check", sql.raw(`("height" is null) = ("height_basis" is null)`)),
    tenantIsolation("levels"),
  ],
).enableRLS();

/**
 * A drawing (identity.md §2): provenance, never key. Discipline is drawing-scoped,
 * machine-proposed, human-confirmed, and fails closed — `discipline_confirmed` is null until a
 * CONFIRM_DISCIPLINE act sets it, and an unconfirmed drawing is not walked at all. Who confirmed
 * and when is the act log's, never stamped here (§7).
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
    disciplineProposed: text("discipline_proposed"),
    disciplineConfirmed: text("discipline_confirmed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("drawings_project_idx").on(t.projectId),
    unique("drawings_id_project_uq").on(t.id, t.projectId),
    unique("drawings_id_tenant_uq").on(t.id, t.tenantId),
    foreignKey({
      name: "drawings_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    enumCheck("drawings_discipline_proposed_check", "discipline_proposed", DISCIPLINES),
    enumCheck("drawings_discipline_confirmed_check", "discipline_confirmed", DISCIPLINES),
    tenantIsolation("drawings"),
  ],
).enableRLS();

/**
 * A drawing revision (identity.md §9): one issue of one drawing, a surrogate id. The label is
 * non-identifying. The file and its EntityGraph artifact hang off the ingest record, which
 * lands with the ingest issue.
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
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("drawing_revisions_drawing_idx").on(t.drawingId),
    unique("drawing_revisions_id_drawing_uq").on(t.id, t.drawingId),
    unique("drawing_revisions_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "drawing_revisions_drawing_project_fk",
      columns: [t.drawingId, t.projectId],
      foreignColumns: [drawings.id, drawings.projectId],
    }),
    foreignKey({
      name: "drawing_revisions_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    tenantIsolation("drawing_revisions"),
  ],
).enableRLS();

/**
 * A drawing-set revision (identity.md §9): an immutable, unordered set of (drawing, revision)
 * pairs, content-addressed — the primary key IS the digest over the member pairs in canonical
 * order (src/core/identity.ts), zero minted ids, so an identical pinned set is the identical set
 * revision. Immutable by grant: the app role may SELECT and INSERT, never UPDATE or DELETE;
 * mutation is a new set revision, advance never drift.
 */
export const drawingSetRevisions = pgTable(
  "drawing_set_revisions",
  {
    digest: text("digest").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("drawing_set_revisions_digest_project_tenant_uq").on(t.digest, t.projectId, t.tenantId),
    foreignKey({
      name: "drawing_set_revisions_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    check("drawing_set_revisions_digest_check", sql.raw(`"digest" ~ '^[0-9a-f]{64}$'`)),
    tenantIsolation("drawing_set_revisions"),
  ],
).enableRLS();

/**
 * The manifest (identity.md §9): the set revision's members, one revision per drawing (the
 * primary key), each pair proven real by a composite FK to the revision *of that drawing*, and
 * the drawing proven to be the set's project's. The manifest is the citation list — there is no
 * second list. Immutable by grant, as the set is.
 */
export const drawingSetRevisionMembers = pgTable(
  "drawing_set_revision_members",
  {
    setDigest: text("set_digest").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    drawingRevisionId: uuid("drawing_revision_id").notNull(),
  },
  (t) => [
    primaryKey({ name: "drawing_set_revision_members_pk", columns: [t.setDigest, t.drawingId] }),
    foreignKey({
      name: "drawing_set_revision_members_set_fk",
      columns: [t.setDigest, t.projectId, t.tenantId],
      foreignColumns: [drawingSetRevisions.digest, drawingSetRevisions.projectId, drawingSetRevisions.tenantId],
    }),
    foreignKey({
      name: "drawing_set_revision_members_drawing_project_fk",
      columns: [t.drawingId, t.projectId],
      foreignColumns: [drawings.id, drawings.projectId],
    }),
    foreignKey({
      name: "drawing_set_revision_members_revision_drawing_fk",
      columns: [t.drawingRevisionId, t.drawingId],
      foreignColumns: [drawingRevisions.id, drawingRevisions.drawingId],
    }),
    tenantIsolation("drawing_set_revision_members"),
  ],
).enableRLS();

/**
 * The register object (identity.md §2): identity is
 * `(project, discipline, level, element type, mark, ordinal)` — the UNIQUE constraint below,
 * NULLS NOT DISTINCT so a lawful-null level (§3: FOUNDATION / UNRESOLVED, exactly one of level
 * or basis) is still one slot in the key. The double-count guard is structural: a second sighting
 * of registered scope is a unique violation, refused at the door, and belongs in
 * refused_sightings. No coordinate, label or correctable attribute is in the key. The ordinal is
 * frozen at first registration by a column-level grant (only mark and the level slot are
 * updatable: a mark rename is an authored act, the level slot moves exactly once). Attributes,
 * quantity lines and sightings hang off `(id, project_id)` and land with the measurement issues.
 */
export const registerObjects = pgTable(
  "register_objects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    discipline: text("discipline").notNull(),
    levelId: uuid("level_id"),
    levelBasis: text("level_basis"),
    elementType: text("element_type").notNull(),
    mark: text("mark").notNull(),
    ordinal: integer("ordinal").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
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
    foreignKey({
      name: "register_objects_level_project_fk",
      columns: [t.levelId, t.projectId],
      foreignColumns: [levels.id, levels.projectId],
    }),
    enumCheck("register_objects_discipline_check", "discipline", DISCIPLINES),
    enumCheck("register_objects_element_type_check", "element_type", ELEMENT_TYPES),
    enumCheck("register_objects_level_basis_check", "level_basis", LEVEL_BASES),
    check("register_objects_level_slot_check", sql.raw(`("level_id" is null) <> ("level_basis" is null)`)),
    check("register_objects_ordinal_check", sql.raw(`"ordinal" >= 1`)),
    tenantIsolation("register_objects"),
  ],
).enableRLS();

/**
 * Refused sightings (identity.md §2, §7, §9): a second sighting of registered scope
 * (DUPLICATE_IDENTITY) or a repudiated object (REPUDIATED), kept as unpriceable evidence in a
 * separate table with **no join from any bill** — a status flag on the register was disqualified
 * as one forgotten WHERE from over-measurement. Nothing bill-shaped references this table and it
 * references nothing bill-shaped (db/__tests__/register.dbspec.ts asserts both). It cites its
 * evidence: the drawing revision and the source keys of the sighting. A duplicate never
 * registered, so it has no ordinal; a repudiated object had one and it retires with it.
 * Append-only by grant.
 */
export const refusedSightings = pgTable(
  "refused_sightings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    cause: text("cause").notNull(),
    discipline: text("discipline").notNull(),
    levelId: uuid("level_id"),
    levelBasis: text("level_basis"),
    elementType: text("element_type").notNull(),
    mark: text("mark").notNull(),
    ordinal: integer("ordinal"),
    drawingRevisionId: uuid("drawing_revision_id").notNull(),
    sourceKeys: text("source_keys").array().notNull(),
    refusedAt: timestamp("refused_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refused_sightings_project_idx").on(t.projectId),
    foreignKey({
      name: "refused_sightings_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    foreignKey({
      name: "refused_sightings_level_project_fk",
      columns: [t.levelId, t.projectId],
      foreignColumns: [levels.id, levels.projectId],
    }),
    foreignKey({
      name: "refused_sightings_revision_project_fk",
      columns: [t.drawingRevisionId, t.projectId],
      foreignColumns: [drawingRevisions.id, drawingRevisions.projectId],
    }),
    enumCheck("refused_sightings_cause_check", "cause", REFUSED_SIGHTING_CAUSES),
    enumCheck("refused_sightings_discipline_check", "discipline", DISCIPLINES),
    enumCheck("refused_sightings_element_type_check", "element_type", ELEMENT_TYPES),
    enumCheck("refused_sightings_level_basis_check", "level_basis", LEVEL_BASES),
    check("refused_sightings_level_slot_check", sql.raw(`("level_id" is null) <> ("level_basis" is null)`)),
    check("refused_sightings_ordinal_check", sql.raw(`("cause" = 'REPUDIATED') = ("ordinal" is not null)`)),
    check("refused_sightings_source_keys_check", sql.raw(`cardinality("source_keys") >= 1`)),
    tenantIsolation("refused_sightings"),
  ],
).enableRLS();

/**
 * The act log (identity.md §7): append-only (SELECT + INSERT grant only), human-only (the actor
 * is a member of the tenant — a composite FK to memberships, so a machine has no row to cite and
 * another tenant's user cannot act here), recorded at the granularity performed (one act, N
 * subjects). Act row and state change commit in one `forTenant` transaction or neither. Subject
 * references are opaque (kind + ids), never FKs: the log outlives its subjects — a repudiated
 * object leaves the register but its act stands. An audit trail beside materialised state, not
 * an event source. Model calls are not acts (ADR-0006): they are machine work, in model_calls.
 */
export const acts = pgTable(
  "acts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    type: text("type").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectIds: uuid("subject_ids").array().notNull(),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("acts_project_idx").on(t.projectId),
    foreignKey({
      name: "acts_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    foreignKey({
      name: "acts_actor_membership_fk",
      columns: [t.tenantId, t.actorUserId],
      foreignColumns: [memberships.tenantId, memberships.userId],
    }),
    enumCheck("acts_type_check", "type", ACT_TYPES),
    check("acts_subjects_check", sql.raw(`cardinality("subject_ids") >= 1`)),
    tenantIsolation("acts"),
  ],
).enableRLS();
