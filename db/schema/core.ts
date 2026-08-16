import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
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
