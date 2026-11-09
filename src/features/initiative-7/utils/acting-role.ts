// Which approval role the signed-in person acts as in the I07 decision panel.
//
// The backend decides what they may do: POST .../actions refuses (403 ROLE_NOT_HELD) any role the
// token does not hold. This only picks the role to send, so the buttons match what the backend allows.

import type { ApiApprovalRole } from "@/features/initiative-7/types/api"
import { ROLES, type Role } from "@/lib/auth/roles"

/** Approval role -> the Entra app role that grants it (mirrors the backend's APPROVAL_ROLE_TO_ENTRA). */
export const ENTRA_ROLE_FOR_APPROVAL_ROLE: Record<ApiApprovalRole, Role> = {
  "End User": ROLES.END_USER,
  "Engineering Manager": ROLES.ENGINEERING_MANAGER,
  "Commercial Manager": ROLES.COMMERCIAL_MANAGER,
  "Warehouse Supervisor": ROLES.WAREHOUSE_SUPERVISOR,
  "Inventory Controller": ROLES.INVENTORY_CONTROLLER_APPROVER,
  "Commercial Head": ROLES.COMMERCIAL_HEAD,
  "Engineering Head": ROLES.ENGINEERING_HEAD,
  "Plant Head": ROLES.PLANT_HEAD,
}

export const DEFAULT_ACTOR_ROLE: ApiApprovalRole = "End User"

const APPROVAL_ROLES = Object.keys(ENTRA_ROLE_FOR_APPROVAL_ROLE) as ApiApprovalRole[]

export interface ActingRoleInput {
  /** The Spares.* roles from GET /api/me. */
  roles: readonly string[]
  /** False while the backend's sign-in is off (and while /api/me has not loaded). */
  authEnabled: boolean
  /** The step the backend says is waiting, if any. */
  pendingRole: string | null
  /** The nonprod test sign-in's own approval role, if that build is in use. */
  testLoginRole: ApiApprovalRole | null
}

/**
 * - Nonprod test sign-in: that test user's role (unchanged).
 * - Sign-in off, or roles not loaded: "End User", as before.
 * - Sign-in on: the approval role the person really holds. If they hold the pending one, that;
 *   otherwise the first they hold (chain order); with none, "End User" -- the backend will refuse it.
 */
export function resolveActingRole({ roles, authEnabled, pendingRole, testLoginRole }: ActingRoleInput): ApiApprovalRole {
  if (testLoginRole) return testLoginRole
  if (!authEnabled) return DEFAULT_ACTOR_ROLE
  const held = APPROVAL_ROLES.filter((role) => roles.includes(ENTRA_ROLE_FOR_APPROVAL_ROLE[role]))
  if (pendingRole && (held as string[]).includes(pendingRole)) return pendingRole as ApiApprovalRole
  return held[0] ?? DEFAULT_ACTOR_ROLE
}
