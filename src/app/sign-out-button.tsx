"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/core/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="border px-3 py-1 text-sm"
      onClick={async () => {
        await authClient.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
