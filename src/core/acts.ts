import { and, eq } from "drizzle-orm";
import type { ActSubject } from "../../db/schema/core";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import type { ActType } from "./enums";

/**
 * The act log's seam (identity.md §7): an act row and the state change it
 * records commit in one transaction or neither. Every human write goes
 * through `withAct`; machine writes never log an act (they are basis +
 * rule id, checkable rather than believable).
 */

export type ActInput<T> = {
  projectId: string;
  /** Acts are human-only: always a real user, never a system principal. */
  actorUserId: string;
  actType: ActType;
  /**
   * Subjects at the granularity performed (one act, N subjects). A function
   * form derives them from the state change's result — the usual case, since
   * the subject rows often do not exist until `fn` runs.
   */
  subjects: ActSubject[] | ((result: T) => ActSubject[]);
  payload?: Record<string, unknown>;
};

/**
 * Seam entry point: opens its own transaction, so it must never be called
 * from inside an existing `forTenant` block — that would be two top-level
 * transactions, and the atomicity this function exists for would be a lie.
 */
export async function withAct<T>(
  ctx: TenantCtx,
  act: ActInput<T>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return forTenant(ctx, async (tx) => {
    // acts are human-only AND tenant-scoped: an actor who is not a member of
    // this tenant cannot author its history (the users FK alone is global)
    const [member] = await tx
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.tenantId, ctx.tenantId),
          eq(schema.memberships.userId, act.actorUserId),
        ),
      );
    if (!member) {
      throw new Error(
        `act refused: actor ${act.actorUserId} is not a member of tenant ${ctx.tenantId}`,
      );
    }
    const result = await fn(tx);
    const subjects =
      typeof act.subjects === "function" ? act.subjects(result) : act.subjects;
    await tx.insert(schema.acts).values({
      tenantId: ctx.tenantId,
      projectId: act.projectId,
      actorUserId: act.actorUserId,
      actType: act.actType,
      subjects,
      payload: act.payload,
    });
    return result;
  });
}

export async function listActs(ctx: TenantCtx, projectId: string) {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.acts)
      .where(
        and(
          eq(schema.acts.tenantId, ctx.tenantId),
          eq(schema.acts.projectId, projectId),
        ),
      )
      .orderBy(schema.acts.createdAt),
  );
}
