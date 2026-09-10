// Small shared list of named people/roles referenced across initiatives
// (approval chains, requesters, escalation targets) — deliberately minimal.

export type SharedRole =
  | "End User"
  | "Engineering Manager"
  | "Commercial Manager"
  | "Warehouse Supervisor"
  | "HOD"
  | "Inventory Control"
  | "Requester"

export interface SharedUser {
  userId: string
  name: string
  role: SharedRole
  department: string
}

export const USERS: SharedUser[] = [
  { userId: "U-001", name: "Thabo Nkosi", role: "End User", department: "Milling" },
  { userId: "U-002", name: "Sarah van Wyk", role: "Engineering Manager", department: "Engineering" },
  { userId: "U-003", name: "Johan Botha", role: "Commercial Manager", department: "Commercial" },
  { userId: "U-004", name: "Nomvula Dlamini", role: "Warehouse Supervisor", department: "Warehouse" },
  { userId: "U-005", name: "Pieter Steyn", role: "HOD", department: "Processing" },
  { userId: "U-006", name: "Lindiwe Mahlangu", role: "Inventory Control", department: "Supply Chain" },
  { userId: "U-007", name: "Riaan Kruger", role: "Requester", department: "Maintenance" },
  { userId: "U-008", name: "Amanda Petersen", role: "Requester", department: "Projects" },
]

export function getUserById(userId: string): SharedUser | undefined {
  return USERS.find((u) => u.userId === userId)
}
