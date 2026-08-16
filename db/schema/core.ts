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
import { detectedUnitSchema } from "../../src/core/entitygraph";
import { INGEST_PARAMETER_KEYS } from "../../src/core/ingest-contract";
import { MODEL_IDS, REFUSAL_CAUSES } from "../../src/core/model";
import { RULE_SET_EDITION_SCOPES, RULE_SET_PARAMETER_KEYS, RULE_SET_SEED_IDS } from "../../src/core/rule-set";
import { authAccess, tenantIsolation } from "./rls";

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

/** A tenant is better-auth's `organization` (ADR-0004; issue #66): `logo` and `metadata` are its columns. */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** better-auth's `user` model (issue #66): `image` and `updated_at` are its columns; the id is ours (uuid, DB-generated). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A B2C user is a single-member tenant: one model, no special cases (ADR-0004). This is
 * better-auth's `member` model (`organizationId` → `tenantId`), so the auth role has its own
 * explicit policy beside the tenant isolation policy (issue #66).
 */
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
  (t) => [
    uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId),
    tenantIsolation("memberships"),
    authAccess("memberships"),
  ],
).enableRLS();

// ---------------------------------------------------------------------------------------------
// better-auth's own tables (issue #66; ADR-0004): sessions, accounts, verifications are per user,
// not per tenant — no tenant_id, no RLS; only the auth role is granted on them. Invitations are
// per tenant: RLS with the tenant policy for the app role and the explicit auth policy.
// ---------------------------------------------------------------------------------------------

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** better-auth's `activeOrganizationId`: the tenant a request's TenantCtx is minted for. */
    activeTenantId: uuid("active_tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** better-auth's `invitation` model (`organizationId` → `tenantId`), tenant-owned. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invitations_tenant_idx").on(t.tenantId),
    index("invitations_email_idx").on(t.email),
    tenantIsolation("invitations"),
    authAccess("invitations"),
  ],
).enableRLS();

/**
 * A rule-set edition (identity.md §8, measurement-rules.md §1): the parameter values in force,
 * as an immutable row. Three layers, two forks — the platform seed ships as a constant
 * (src/core/rule-set.ts), a tenant's TEMPLATE edition forks from it at tenant creation, and a
 * PROJECT edition forks from that template at project creation. Immutable **by grant**: the app
 * role may SELECT and INSERT, never UPDATE or DELETE, so authoring mints a new edition and no
 * code path can rewrite one.
 *
 * `key` is the content address (src/core/rule-set.ts): a digest over the parameter values and the
 * (rule id, version) pairs below. It is not the primary key — a project edition forked unchanged
 * from its template carries the *same* content, hence the same key, and both are real rows.
 *
 * Lineage is a column, so a project edition traces back through its template to the seed: exactly
 * one parent slot is filled — another edition, or the seed the constant names — and the two
 * checks pair the slot with the scope, so a TEMPLATE forks the seed and a PROJECT forks an
 * edition. Authoring, which mints a template from a template, supersedes that pairing when it
 * lands; nothing pre-customer authors.
 */
export const ruleSetEditions = pgTable(
  "rule_set_editions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    scope: text("scope").notNull(),
    forkedFromEditionId: uuid("forked_from_edition_id"),
    forkedFromSeed: text("forked_from_seed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rule_set_editions_tenant_idx").on(t.tenantId),
    // pair target for the project pin, for the children below, and for the lineage FK
    unique("rule_set_editions_id_tenant_uq").on(t.id, t.tenantId),
    // One template in force per tenant: "the rule set in force" is a stored fact, never a query
    // that widens (§8). A second template arrives with authoring, which supersedes this index.
    uniqueIndex("rule_set_editions_tenant_template_uq").on(t.tenantId).where(sql`"scope" = 'TEMPLATE'`),
    foreignKey({
      name: "rule_set_editions_forked_from_tenant_fk",
      columns: [t.forkedFromEditionId, t.tenantId],
      foreignColumns: [t.id, t.tenantId],
    }),
    enumCheck("rule_set_editions_scope_check", "scope", RULE_SET_EDITION_SCOPES),
    enumCheck("rule_set_editions_forked_from_seed_check", "forked_from_seed", RULE_SET_SEED_IDS),
    check("rule_set_editions_key_check", sql.raw(`"key" ~ '^[0-9a-f]{64}$'`)),
    check(
      "rule_set_editions_lineage_check",
      sql.raw(`("forked_from_edition_id" is null) <> ("forked_from_seed" is null)`),
    ),
    check(
      "rule_set_editions_project_lineage_check",
      sql.raw(`("scope" = 'PROJECT') = ("forked_from_edition_id" is not null)`),
    ),
    tenantIsolation("rule_set_editions"),
  ],
).enableRLS();

/**
 * The project record (identity.md §8, amended 2026-08-16): the rule-set pin is a column that
 * references a **real row**, NOT NULL and composite with the tenant, so an unpinned project is
 * unrepresentable and a project can never point at another tenant's edition. The three nullable
 * free-text pins this table carried (book edition, rule set, multiplier scheme) are dropped by
 * migration 0005: two of them are pricing instruments that return with the book, and a nullable
 * fallback makes "the rule set in force" a query result that widens under a signed bill.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    ruleSetEditionId: uuid("rule_set_edition_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_tenant_idx").on(t.tenantId),
    // pair target for children's composite FKs
    unique("projects_id_tenant_uq").on(t.id, t.tenantId),
    foreignKey({
      name: "projects_rule_set_edition_tenant_fk",
      columns: [t.ruleSetEditionId, t.tenantId],
      foreignColumns: [ruleSetEditions.id, ruleSetEditions.tenantId],
    }),
    tenantIsolation("projects"),
  ],
).enableRLS();

/**
 * An edition's parameter values (measurement-rules.md §1): `numeric` in the DB, decimal at the
 * seam — never a float (CLAUDE.md). One row per key, the key vocabulary emitted as a CHECK from
 * src/core/rule-set.ts. These values are what the edition key digests; immutable by grant, as the
 * edition is.
 */
export const ruleSetEditionParameters = pgTable(
  "rule_set_edition_parameters",
  {
    editionId: uuid("edition_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    value: numeric("value").notNull(),
  },
  (t) => [
    primaryKey({ name: "rule_set_edition_parameters_pk", columns: [t.editionId, t.key] }),
    foreignKey({
      name: "rule_set_edition_parameters_edition_tenant_fk",
      columns: [t.editionId, t.tenantId],
      foreignColumns: [ruleSetEditions.id, ruleSetEditions.tenantId],
    }),
    enumCheck("rule_set_edition_parameters_key_check", "key", RULE_SET_PARAMETER_KEYS),
    // `numeric` stores NaN and ±Infinity, and NaN sorts above every number — a threshold that
    // inverts the rule it governs instead of refusing. The seam refuses one too (rule-set.ts).
    check(
      "rule_set_edition_parameters_value_finite_check",
      sql.raw(`"value" > '-Infinity'::numeric and "value" < 'Infinity'::numeric`),
    ),
    tenantIsolation("rule_set_edition_parameters"),
  ],
).enableRLS();

/**
 * The methods in force for an edition (measurement-rules.md §1): methods are code, never
 * configurable, enumerated by (rule id, version) — the pairs the edition key digests beside the
 * parameter values, so a method version bump moves the key. One row per rule id (the primary
 * key): two versions of one method is not an edition. Immutable by grant, as the edition is.
 */
export const ruleSetEditionMethods = pgTable(
  "rule_set_edition_methods",
  {
    editionId: uuid("edition_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    ruleId: text("rule_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ name: "rule_set_edition_methods_pk", columns: [t.editionId, t.ruleId] }),
    foreignKey({
      name: "rule_set_edition_methods_edition_tenant_fk",
      columns: [t.editionId, t.tenantId],
      foreignColumns: [ruleSetEditions.id, ruleSetEditions.tenantId],
    }),
    check("rule_set_edition_methods_version_check", sql.raw(`"version" >= 1`)),
    tenantIsolation("rule_set_edition_methods"),
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

/**
 * The ingest record (cad-ingestion.md §2–§3, ADR-0001): one row per run of `cad/` over one
 * uploaded file for one drawing revision. The DB stores references — paths under
 * VEXTRUS_STORAGE_ROOT and content digests — never blobs. It pins the extractor identity
 * (version + parameter-set hash) so a re-minted key multiset is detectable, and carries the
 * artifact's fidelity counters verbatim (`explode_truncated`, `lost_by_type`,
 * `unsupported_by_type`) — surfacing truncation is mandatory (quantity-contract.md §2). The unit
 * is reported, never interpreted: an unmapped $INSUNITS is null + flagged, and nothing here
 * multiplies geometry (measurement-rules.md §5). Immutable by grant: an artifact freezes at
 * ingest; upgrading the extractor is a declared re-ingest, a new row.
 */
export const ingests = pgTable(
  "ingests",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id").notNull(),
    drawingRevisionId: uuid("drawing_revision_id").notNull(),
    uploadFilename: text("upload_filename").notNull(),
    uploadRef: text("upload_ref").notNull(),
    uploadSha256: text("upload_sha256").notNull(),
    artifactRef: text("artifact_ref").notNull(),
    artifactSha256: text("artifact_sha256").notNull(),
    extractorVersion: text("extractor_version").notNull(),
    extractorParameters: jsonb("extractor_parameters").$type<Record<(typeof INGEST_PARAMETER_KEYS)[number], number>>().notNull(),
    extractorParameterHash: text("extractor_parameter_hash").notNull(),
    insunits: integer("insunits"),
    unitDetected: text("unit_detected"),
    insunitsUnmapped: boolean("insunits_unmapped").notNull(),
    original: integer("original").notNull(),
    derived: integer("derived").notNull(),
    explodeTruncated: boolean("explode_truncated").notNull(),
    lostByType: jsonb("lost_by_type").$type<Record<string, number>>().notNull(),
    unsupportedByType: jsonb("unsupported_by_type").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ingests_revision_idx").on(t.drawingRevisionId),
    unique("ingests_id_project_uq").on(t.id, t.projectId),
    foreignKey({
      name: "ingests_project_tenant_fk",
      columns: [t.projectId, t.tenantId],
      foreignColumns: [projects.id, projects.tenantId],
    }),
    foreignKey({
      name: "ingests_revision_project_fk",
      columns: [t.drawingRevisionId, t.projectId],
      foreignColumns: [drawingRevisions.id, drawingRevisions.projectId],
    }),
    enumCheck("ingests_unit_detected_check", "unit_detected", detectedUnitSchema.options),
    check("ingests_upload_sha256_check", sql.raw(`"upload_sha256" ~ '^[0-9a-f]{64}$'`)),
    check("ingests_artifact_sha256_check", sql.raw(`"artifact_sha256" ~ '^[0-9a-f]{64}$'`)),
    check("ingests_extractor_parameter_hash_check", sql.raw(`"extractor_parameter_hash" ~ '^[0-9a-f]{64}$'`)),
    check("ingests_counters_check", sql.raw(`"original" >= 0 and "derived" >= 0`)),
    tenantIsolation("ingests"),
  ],
).enableRLS();
