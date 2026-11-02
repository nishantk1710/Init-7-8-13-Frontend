import { describe, expect, it } from "vitest"

import { parseAuthMode } from "@/lib/auth/mode"
import { hasAnyRole, requiredRolesText, roleLabel, ROLES } from "@/lib/auth/roles"

describe("roles", () => {
  it("are the 16 values on the API's app registration (backend app/core/security.py)", () => {
    expect(new Set(Object.values(ROLES))).toEqual(
      new Set([
        "Spares.Viewer", "Spares.Requester", "Spares.Stores", "Spares.HOD", "Spares.Commercial",
        "Spares.InventoryController", "Spares.EndUser", "Spares.EngineeringManager",
        "Spares.CommercialManager", "Spares.WarehouseSupervisor", "Spares.InventoryControllerApprover",
        "Spares.CommercialHead", "Spares.EngineeringHead", "Spares.PlantHead", "Spares.Admin",
        "Sap.Events.Write",
      ])
    )
  })

  it("hasAnyRole is any-of", () => {
    const held = [ROLES.VIEWER, ROLES.STORES]
    expect(hasAnyRole(held, ROLES.STORES)).toBe(true)
    expect(hasAnyRole(held, ROLES.ADMIN, ROLES.STORES)).toBe(true)
    expect(hasAnyRole(held, ROLES.ADMIN)).toBe(false)
    expect(hasAnyRole([], ROLES.VIEWER)).toBe(false)
  })

  it("labels read as words", () => {
    expect(roleLabel(ROLES.INVENTORY_CONTROLLER)).toBe("Inventory Controller")
    expect(roleLabel(ROLES.HOD)).toBe("Head of Department")
    expect(roleLabel(ROLES.INVENTORY_CONTROLLER_APPROVER)).toBe("Inventory Controller Approver")
    expect(requiredRolesText(ROLES.HOD, ROLES.COMMERCIAL)).toBe("Requires role: Head of Department or Commercial")
  })
})

describe("auth mode", () => {
  it("is mock unless exactly entra", () => {
    expect(parseAuthMode(undefined)).toBe("mock")
    expect(parseAuthMode("")).toBe("mock")
    expect(parseAuthMode("mock")).toBe("mock")
    expect(parseAuthMode("ENTRA ")).toBe("entra")
    expect(parseAuthMode("entra-id")).toBe("mock")
  })
})
