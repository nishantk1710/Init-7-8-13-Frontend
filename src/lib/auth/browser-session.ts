// The Microsoft sign-in session as the BROWSER sees it (AUTH_MODE=entra).
//
// Fetched from Auth.js's /api/auth/session -- which also renews the access
// token when it is near expiry -- and kept until shortly before the token
// lapses, so the many API calls a page makes cost one session fetch. Loading
// this module registers it as the browser's token provider for
// lib/api/client.ts (see lib/api/token.ts); components/auth/auth-bridge.tsx
// makes sure that happens on every page.
//
// Browser-only: imported by client components and hooks, never by the server.

import type { Session } from "next-auth"
import { getSession } from "next-auth/react"

import { registerAccessTokenProvider } from "@/lib/api/token"
import { browserAuthMode } from "@/lib/auth/mode"

/** Fetch the session again this long before its access token expires. */
const RENEW_MARGIN_MS = 60 * 1000

let cached: Session | null = null
let inflight: Promise<Session | null> | null = null
const listeners = new Set<() => void>()

function fresh(session: Session | null): boolean {
  return Boolean(
    session?.accessToken && session.accessTokenExpires && Date.now() < session.accessTokenExpires - RENEW_MARGIN_MS
  )
}

/** The session, fetched only when the cached one is missing or about to expire. Null in mock mode. */
export function loadSession(): Promise<Session | null> {
  if (browserAuthMode() !== "entra") return Promise.resolve(null)
  if (fresh(cached)) return Promise.resolve(cached)
  inflight ??= getSession()
    .then((session) => {
      cached = session
      return session
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
      listeners.forEach((notify) => notify())
    })
  return inflight
}

/** For useSyncExternalStore. */
export function cachedSession(): Session | null {
  return cached
}

export function subscribeSession(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

registerAccessTokenProvider("browser", async () => {
  const session = await loadSession()
  return session && !session.error ? (session.accessToken ?? null) : null
})
