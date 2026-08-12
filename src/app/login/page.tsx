"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/core/auth-client";

/** Minimal login/register (ticket 01: the mechanism, not the design system). */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (error) {
      setError(error.message ?? "authentication failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="flex w-72 flex-col gap-3">
        <h1 className="text-xl font-semibold">
          {mode === "sign-in" ? "Log in" : "Register"}
        </h1>
        {mode === "sign-up" && (
          <input
            className="border p-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="border p-2 font-medium disabled:opacity-50"
        >
          {mode === "sign-in" ? "Log in" : "Create account"}
        </button>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        >
          {mode === "sign-in"
            ? "No account? Register"
            : "Have an account? Log in"}
        </button>
      </form>
    </main>
  );
}
