"use client"

import { createContext, useContext, useMemo, useState } from "react"

import { useRoles } from "@/hooks/use-roles"
import { ROLES } from "@/lib/auth/roles"
import { SHARED_ROLES, type SharedRole } from "@/lib/shared-data/users"

/** The signed-in role that each "viewing as" choice corresponds to. */
const VIEW_FOR_ROLE: Record<SharedRole, string> = {
  "End User": ROLES.END_USER,
  "Engineering Manager": ROLES.ENGINEERING_MANAGER,
  "Commercial Manager": ROLES.COMMERCIAL_MANAGER,
  "Warehouse Supervisor": ROLES.WAREHOUSE_SUPERVISOR,
  HOD: ROLES.HOD,
  "Inventory Control": ROLES.INVENTORY_CONTROLLER,
  Requester: ROLES.REQUESTER,
}

/** The first view (in menu order) the user's real roles match; "End User" otherwise, as before. */
function defaultView(roles: string[]): SharedRole {
  return SHARED_ROLES.find((view) => roles.includes(VIEW_FOR_ROLE[view])) ?? "End User"
}

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
 *
 * Until the user picks a view it follows their signed-in roles (GET /api/me):
 * an Engineering Manager opens as one. Still only a preference -- what they may
 * do is decided by their roles, on the backend.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { roles } = useRoles()
  const [chosen, setRole] = useState<SharedRole | null>(null)
  const role = chosen ?? defaultView(roles)
  const value = useMemo(() => ({ role, setRole }), [role])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>")
  return ctx
}
