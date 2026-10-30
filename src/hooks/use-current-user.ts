"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { cachedSession, loadSession, subscribeSession } from "@/lib/auth/browser-session"
import { authSnapshot, currentUser, subscribeAuth, type MockUser } from "@/lib/auth/mock-auth"
import { browserAuthMode, type AuthMode } from "@/lib/auth/mode"

function subscribeNever(): () => void {
  return () => {}
}

function serverMode(): AuthMode {
  return "mock"
}

/**
 * The signed-in user, or null.
 *
 * Microsoft sign-in (AUTH_MODE=entra): name and e-mail from the Auth.js session.
 * Test sign-in: the mock user (lib/auth/mock-auth.ts), as before.
 *
 * Null during server rendering and the first client render: the session is
 * read in the browser, and reading it on the server would make every page
 * dynamic. Callers render a neutral placeholder until it resolves.
 */
export function useCurrentUser(): MockUser | null {
  const mode = useSyncExternalStore(subscribeNever, browserAuthMode, serverMode)
  const snapshot = useSyncExternalStore(subscribeAuth, authSnapshot, () => null)
  const session = useSyncExternalStore(subscribeSession, cachedSession, () => null)

  useEffect(() => {
    if (mode === "entra") void loadSession()
  }, [mode])

  return useMemo(() => {
    if (mode === "entra") {
      const user = session?.user
      if (!user) return null
      const email = user.email ?? ""
      return { username: email || (session.oid ?? ""), name: user.name || email, email, source: "entra" as const }
    }
    // The snapshot string changes exactly when the mock session or an account does.
    return snapshot === null ? null : currentUser()
  }, [mode, snapshot, session])
}
