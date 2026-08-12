import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  accounts,
  invitations,
  sessions,
  verifications,
} from "../../db/schema/auth";
import { memberships, tenants, users } from "../../db/schema/core";

/**
 * The auth machinery (ticket 01, ADR-0004). better-auth is extended, never
 * hand-rolled: email/password plus the organization plugin, with organization
 * mapped onto `tenants` and member onto `memberships` — auth and the tenant
 * seam share one model, so a B2C signup creating a personal tenant and a B2B
 * organization are the same shape.
 *
 * Connection: the auth lane runs as vextrus_auth (constrained role, explicit
 * policies — migration 0003), never as owner. The handle is module-private;
 * app queries still cannot obtain anything but `forTenant`/`runAsSystem`.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const authSchema = {
  users,
  tenants,
  memberships,
  sessions,
  accounts,
  verifications,
  invitations,
};

const authDb = drizzle(postgres(requireEnv("AUTH_DATABASE_URL"), { max: 5 }), {
  schema: authSchema,
});

export const auth = betterAuth({
  database: drizzleAdapter(authDb, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  telemetry: { enabled: false },
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: { database: { generateId: "uuid" } },
  plugins: [
    organization({
      schema: {
        session: { fields: { activeOrganizationId: "activeTenantId" } },
        organization: { modelName: "tenants" },
        member: {
          modelName: "memberships",
          fields: { organizationId: "tenantId" },
        },
        invitation: {
          modelName: "invitations",
          fields: { organizationId: "tenantId" },
        },
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // A signup IS a tenant creation: every new user gets a single-member
        // tenant — one model, no B2C special case (ADR-0004).
        after: async (user) => {
          const tenantId = crypto.randomUUID();
          await authDb.insert(tenants).values({
            id: tenantId,
            name: user.name,
            slug: tenantId,
          });
          await authDb.insert(memberships).values({
            tenantId,
            userId: user.id,
            role: "owner",
          });
        },
      },
    },
    session: {
      create: {
        // Sign-in sessions open on the user's first tenant. Signup sessions
        // find no membership here (better-auth defers user.create.after past
        // session creation) — the tRPC auth middleware heals those once.
        before: async (session) => {
          const [membership] = await authDb
            .select({ tenantId: memberships.tenantId })
            .from(memberships)
            .where(eq(memberships.userId, session.userId))
            .orderBy(asc(memberships.createdAt))
            .limit(1);
          return {
            data: { ...session, activeOrganizationId: membership?.tenantId },
          };
        },
      },
    },
  },
});
