"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const authClient = createAuthClient();

/**
 * The sign-in / sign-up form for the first request path (issue #66): better-auth's own client
 * against its own route; on success the server component re-renders with a session.
 */
export function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? result.error.statusText ?? "SIGN_IN_FAILED");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <h2>{mode === "sign-up" ? "Create an account" : "Sign in"}</h2>
      {mode === "sign-up" ? (
        <label>
          Name <input name="name" required autoComplete="name" />
        </label>
      ) : null}
      <label>
        Email <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Password <input name="password" type="password" required minLength={8} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} />
      </label>
      <button type="submit">{mode === "sign-up" ? "Sign up" : "Sign in"}</button>
      <button type="button" onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}>
        {mode === "sign-up" ? "I have an account" : "I need an account"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
