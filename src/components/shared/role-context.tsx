"use client"

import { createContext, useContext, useMemo, useState } from "react"

import type { SharedRole } from "@/lib/shared-data/users"

interface RoleContextValue {
  role: SharedRole
  setRole: (role: SharedRole) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

/**
 * Which role the viewer is "viewing as". Mounted once in the live layout so
 * the choice survives a move from Home to Approvals to Audit; it used to be
 * `useState` inside Home, which reset on every navigation.
 *
 * This is a **view preference** — it re-ranks Home's priority actions and
 * nothing else. It is deliberately not connected to `lib/api/actor.ts`:
 * the actor id stamps the author of rows in append-only tables that cannot
 * be corrected afterwards, so a dropdown must not be able to rewrite it.
 *
 * In memory only. Persisting it would need a cookie read on the server to
 * avoid a hydration mismatch, and nothing asked for that yet.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<SharedRole>("End User")
  const value = useMemo(() => ({ role, setRole }), [role])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>")
  return ctx
}
