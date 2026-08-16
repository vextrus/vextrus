import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { and, count, eq } from "drizzle-orm";
import { AUTH_MODELS, authAdapter, forTenant, mintTenantCtx, schema } from "@/core/db";
import { requireEnv } from "@/core/env";
import { mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * identity.md §8 (amended 2026-08-16): a project can never exist without naming the rules that
 * will measure it, so creating a tenant mints that tenant's rule-set **template** edition from the
 * platform seed — the first of the two forks, and the only thing that materialises the seed
 * (nothing is seeded into the database). A tenant is created exactly here, through better-auth's
 * organization API, so this hook is where the mint belongs. It runs after the organization row
 * exists: a mint that fails leaves a tenant with no template, and project creation then refuses by
 * name (`RULE_SET_TEMPLATE_MISSING`) rather than forking a fiction.
 */
async function mintRuleSetTemplate(tenantId: string): Promise<void> {
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantId));
}

/**
 * identity.md §7: the act log is append-only and human-only, and an act's actor is a membership
 * (`acts_actor_membership_fk`). A membership with acts therefore cannot be deleted — the database
 * refuses — and this names that refusal (issue #77) before the DELETE runs, on both routes that
 * delete a membership: an owner removing a member (the plugin's `beforeRemoveMember`) and a member
 * leaving (`/organization/leave`, for which the plugin exposes no hook, so the endpoint hook).
 * The lifecycle answer — a membership that *ends* rather than disappears — is a schema decision
 * not yet taken; until it is, the named refusal is the truth. Auth middleware may mint the
 * TenantCtx (ADR-0004); the count runs under the tenant's own RLS policy.
 */
export const MEMBER_HAS_ACTS = "MEMBER_HAS_ACTS";
async function refuseIfActor(tenantId: string, userId: string): Promise<void> {
  const [row] = await forTenant(mintTenantCtx(tenantId), (tx) =>
    tx
      .select({ n: count() })
      .from(schema.acts)
      .where(and(eq(schema.acts.tenantId, tenantId), eq(schema.acts.actorUserId, userId))),
  );
  if ((row?.n ?? 0) > 0) {
    throw APIError.fromStatus("CONFLICT", {
      code: MEMBER_HAS_ACTS,
      message: "this member has acts in the act log; the log is append-only and its actor must remain a member (identity.md §7)",
    });
  }
}

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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/organization/leave") return;
        const organizationId = (ctx.body as { organizationId?: unknown } | undefined)?.organizationId;
        const session = await getSessionFromCtx(ctx);
        // No session or no organization: the endpoint's own middleware refuses; nothing to guard.
        if (!session || typeof organizationId !== "string") return;
        await refuseIfActor(organizationId, session.user.id);
      }),
    },
    plugins: [
      organization({
        schema: {
          organization: { modelName: AUTH_MODELS.organization },
          member: { modelName: AUTH_MODELS.member, fields: { organizationId: "tenantId" } },
          invitation: { modelName: AUTH_MODELS.invitation, fields: { organizationId: "tenantId" } },
          session: { fields: { activeOrganizationId: "activeTenantId" } },
        },
        organizationHooks: {
          afterCreateOrganization: ({ organization }) => mintRuleSetTemplate(organization.id),
          beforeRemoveMember: ({ member, organization }) => refuseIfActor(organization.id, member.userId),
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
