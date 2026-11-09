import { describe, expect, it } from "vitest"

import { resolveActingRole } from "@/features/initiative-7/utils/acting-role"
import { ROLES } from "@/lib/auth/roles"

const base = { authEnabled: true, pendingRole: null, testLoginRole: null } as const

describe("resolveActingRole", () => {
  it("uses the nonprod test sign-in's role when there is one", () => {
    expect(resolveActingRole({ ...base, roles: [], testLoginRole: "Plant Head" })).toBe("Plant Head")
  })

  it("stays End User while sign-in is off", () => {
    expect(resolveActingRole({ ...base, authEnabled: false, roles: [], pendingRole: "Plant Head" })).toBe("End User")
  })

  it("acts as the role the person holds", () => {
    expect(resolveActingRole({ ...base, roles: [ROLES.ENGINEERING_HEAD] })).toBe("Engineering Head")
  })

  it("maps the Inventory Controller step to the InventoryControllerApprover role", () => {
    expect(resolveActingRole({ ...base, roles: [ROLES.INVENTORY_CONTROLLER_APPROVER] })).toBe("Inventory Controller")
    // The older Spares.InventoryController role is not an approval stage.
    expect(resolveActingRole({ ...base, roles: [ROLES.INVENTORY_CONTROLLER] })).toBe("End User")
  })

  it("picks the pending step among several held roles", () => {
    const roles = [ROLES.ENGINEERING_HEAD, ROLES.PLANT_HEAD]
    expect(resolveActingRole({ ...base, roles, pendingRole: "Plant Head" })).toBe("Plant Head")
    expect(resolveActingRole({ ...base, roles, pendingRole: "Commercial Head" })).toBe("Engineering Head")
  })

  it("falls back to End User when no approval role is held", () => {
    expect(resolveActingRole({ ...base, roles: [ROLES.VIEWER, ROLES.ADMIN] })).toBe("End User")
  })
})
