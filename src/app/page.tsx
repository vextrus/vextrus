import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import Link from "next/link";
import { createCaller } from "@/server/router";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const h = await headers();
  const caller = createCaller({ headers: new Headers(Array.from(h.entries())) });
  try {
    const me = await caller.me();
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <h1 className="text-2xl font-semibold">Vextrus</h1>
        <p>
          {me.user.name} ({me.user.email})
        </p>
        <p className="text-sm text-gray-600">
          Tenant: {me.tenant.name} · {me.role}
        </p>
        <SignOutButton />
      </main>
    );
  } catch (err) {
    // no session is the expected signed-out state; anything else propagates
    if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3">
          <h1 className="text-2xl font-semibold">Vextrus</h1>
          <Link className="underline" href="/login">
            Log in
          </Link>
        </main>
      );
    }
    throw err;
  }
}
