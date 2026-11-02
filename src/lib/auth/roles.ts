// The app roles defined on the API's Entra app registration (spares-ai-api-<env>),
// the same 16 values as app/core/security.py's Roles on the backend.
//
// The BACKEND enforces every rule; the web app only uses roles to disable or
// hide what the user cannot do, so a click never ends in a "forbidden" error.
// Pattern for a button the user may not press: disabled, with the tooltip
// requiredRolesText(...). Admin-only tools may be hidden instead.
//
// Kept free of imports so server and client code can both use it.

export const ROLES = {
  VIEWER: "Spares.Viewer",
  REQUESTER: "Spares.Requester",
  STORES: "Spares.Stores",
  HOD: "Spares.HOD",
  COMMERCIAL: "Spares.Commercial",
  INVENTORY_CONTROLLER: "Spares.InventoryController",
  // I07 approval stages.
  END_USER: "Spares.EndUser",
  ENGINEERING_MANAGER: "Spares.EngineeringManager",
  COMMERCIAL_MANAGER: "Spares.CommercialManager",
  WAREHOUSE_SUPERVISOR: "Spares.WarehouseSupervisor",
  INVENTORY_CONTROLLER_APPROVER: "Spares.InventoryControllerApprover",
  COMMERCIAL_HEAD: "Spares.CommercialHead",
  ENGINEERING_HEAD: "Spares.EngineeringHead",
  PLANT_HEAD: "Spares.PlantHead",
  ADMIN: "Spares.Admin",
  // VZI's CPI application only, never a person.
  SAP_EVENTS_WRITE: "Sap.Events.Write",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/** True when `held` contains at least one of `needed`. */
export function hasAnyRole(held: readonly string[], ...needed: Role[]): boolean {
  return needed.some((role) => held.includes(role))
}

/** "Spares.InventoryController" -> "Inventory Controller", for tooltips and the profile. */
export function roleLabel(role: string): string {
  const name = role.split(".").pop() ?? role
  if (name === "HOD") return "Head of Department"
  return name.replace(/([a-z])([A-Z])/g, "$1 $2")
}

/** The tooltip for a control the user's roles do not allow. */
export function requiredRolesText(...needed: Role[]): string {
  return `Requires role: ${needed.map(roleLabel).join(" or ")}`
}
