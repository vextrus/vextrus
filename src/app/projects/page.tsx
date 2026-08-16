import { headers } from "next/headers";
import { createCaller } from "@/server/router";
import { createContext } from "@/server/trpc";
import { SignIn, SignOut } from "./sign-in";

/**
 * The first page (issue #66): authenticate from the request's headers, mint the TenantCtx, run
 * `projects.list` through the seam, render it. `headers()` makes the route dynamic — nothing here
 * is prerendered, and without a session nothing is queried.
 */
export default async function ProjectsPage() {
  const ctx = await createContext(await headers());
  if (!ctx.userId) {
    return (
      <main>
        <h1>Projects</h1>
        <SignIn />
      </main>
    );
  }
  if (!ctx.tenant) {
    return (
      <main>
        <h1>Projects</h1>
        <p>NO_TENANT_CONTEXT — this account has no active tenant.</p>
        <SignOut />
      </main>
    );
  }
  const projects = await createCaller(ctx).projects.list();
  return (
    <main>
      <h1>Projects</h1>
      {projects.length === 0 ? <p>No projects yet.</p> : (
        <ul>
          {projects.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}
      <SignOut />
    </main>
  );
}
