"use client"

import { useMemo, useSyncExternalStore } from "react"

import { authSnapshot, currentUser, subscribeAuth, type MockUser } from "@/lib/auth/mock-auth"

/**
 * The signed-in mock user (lib/auth/mock-auth.ts), or null.
 *
 * Null during server rendering and the first client render: the session lives
 * in a browser cookie and localStorage, and reading it on the server would make
 * every page dynamic. Callers render a neutral placeholder until it resolves.
 */
export function useCurrentUser(): MockUser | null {
  const snapshot = useSyncExternalStore(subscribeAuth, authSnapshot, () => null)
  // The snapshot string changes exactly when the session or an account does.
  return useMemo(() => (snapshot === null ? null : currentUser()), [snapshot])
}
