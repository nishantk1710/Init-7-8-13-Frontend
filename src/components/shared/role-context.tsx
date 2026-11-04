"use client"

import { createContext, useContext, useMemo } from "react"

import { useRoles } from "@/hooks/use-roles"
import { ROLES } from "@/lib/auth/roles"
import { SHARED_ROLES, type SharedRole } from "@/lib/shared-data/users"

/** The signed-in role each view corresponds to. */
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
}

const RoleContext = createContext<RoleContextValue | null>(null)

/**
 * The role the viewer's pages are shaped for, from their signed-in roles
 * (GET /api/me): an Engineering Manager opens as one. Roles come from Entra,
 * so the old "Viewing as" picker is gone (removed 2026-11-04) -- there is no
 * manual override any more, only the first view the person's real roles match.
 *
 * Still only a view preference -- it re-ranks Home's priority actions and
 * nothing else. It is deliberately not connected to `lib/api/actor.ts`:
 * the actor id stamps the author of rows in append-only tables that cannot
 * be corrected afterwards, so a view must not be able to rewrite it. What
 * the person may do is decided by their roles, on the backend.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { roles } = useRoles()
  const role = defaultView(roles)
  const value = useMemo(() => ({ role }), [role])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>")
  return ctx
}
