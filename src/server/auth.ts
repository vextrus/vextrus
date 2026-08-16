import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { AUTH_MODELS, authAdapter } from "@/core/db";
import { requireEnv } from "@/core/env";

/**
 * Auth (issue #66; ADR-0004): better-auth, email/password + organizations, extended never
 * hand-rolled. An organization is a tenant, a member is a membership; a B2C user is a
 * single-member tenant — sign-up creates the user's personal tenant through better-auth's own
 * organization API, and a new session's active organization is the user's first membership,
 * so the request path can mint a TenantCtx from it (src/server/trpc.ts). Built lazily: the
 * secret and origin are read at first use, never at import (next build imports route modules).
 */
function build() {
  const auth = betterAuth({
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: requireEnv("BETTER_AUTH_URL"),
    database: authAdapter(),
    emailAndPassword: { enabled: true },
    // Ids are ours: uuid columns with DB defaults; better-auth generates none (INSERT … RETURNING on pg).
    advanced: { database: { generateId: false } },
    user: { modelName: AUTH_MODELS.user },
    session: { modelName: AUTH_MODELS.session },
    account: { modelName: AUTH_MODELS.account },
    verification: { modelName: AUTH_MODELS.verification },
    databaseHooks: {
      user: {
        create: {
          // Sign-up creates the personal tenant. better-auth creates the sign-up session before
          // this hook runs, so the fresh tenant is then set active on that session through the
          // adapter; later sign-ins get it from the session hook below.
          after: async (user, context) => {
            const org = await auth.api.createOrganization({
              body: { name: user.name, slug: `personal-${user.id}`, userId: user.id },
            });
            if (org && context) {
              await context.context.adapter.updateMany({
                model: "session",
                where: [{ field: "userId", value: user.id }],
                update: { activeOrganizationId: org.id },
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            if (!context) return;
            const [first] = await context.context.adapter.findMany<{ organizationId: string }>({
              model: "member",
              where: [{ field: "userId", value: session.userId }],
              sortBy: { field: "createdAt", direction: "asc" },
              limit: 1,
            });
            if (!first) return;
            return { data: { ...session, activeOrganizationId: first.organizationId } };
          },
        },
      },
    },
    plugins: [
      organization({
        schema: {
          organization: { modelName: AUTH_MODELS.organization },
          member: { modelName: AUTH_MODELS.member, fields: { organizationId: "tenantId" } },
          invitation: { modelName: AUTH_MODELS.invitation, fields: { organizationId: "tenantId" } },
          session: { fields: { activeOrganizationId: "activeTenantId" } },
        },
      }),
    ],
  });
  return auth;
}

let instance: ReturnType<typeof build> | undefined;
export function getAuth() {
  instance ??= build();
  return instance;
}
export type Auth = ReturnType<typeof build>;
