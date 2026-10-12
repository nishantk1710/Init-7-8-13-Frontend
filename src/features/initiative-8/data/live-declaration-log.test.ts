import { describe, expect, it } from "vitest"

import { toDeclarationRecord } from "@/features/initiative-8/data/live-declaration-log"
import type { ApiAttestation } from "@/lib/api/i8"

function attestation(overrides: Partial<ApiAttestation> = {}): ApiAttestation {
  return {
    id: "ATT-1",
    material: { materialId: "8000005632", materialCode: "8000005632", description: "Seal Kit" },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    quantity: "2.000",
    conditionDescription: "Seal weeping at the gland.",
    faultCategory: "SEAL_LEAK",
    recommendation: "SCRAP",
    condition: "Scrap",
    serialNumber: null,
    evidenceReference: null,
    attestor: "UNAUTHENTICATED_LOCAL_USER",
    attestedAt: "2026-10-09T08:00:00Z",
    sessionId: null,
    supersedes: null,
    supersededBy: null,
    coversRepairLines: ["4500001234-00010"],
    coverageNote: null,
    ...overrides,
  }
}

describe("toDeclarationRecord", () => {
  it("maps an attestation onto the screen's record", () => {
    const r = toDeclarationRecord(attestation())

    expect(r.quantity).toBe(2)
    expect(r.condition).toBe("Scrap")
    expect(r.declaredBy).toBe("UNAUTHENTICATED_LOCAL_USER")
    expect(r.repairLineIds).toEqual(["4500001234-00010"])
    // Null on the wire is absent here, never an empty string on an audit record.
    expect(r.serialNumber).toBeUndefined()
    expect(r.supersededBy).toBeUndefined()
  })

  it("shows the material number where the universe has no description", () => {
    const r = toDeclarationRecord(
      attestation({ material: { materialId: "8000000007", materialCode: "8000000007", description: null } }),
    )
    expect(r.material.description).toBe("8000000007")
  })

  it("reads a backend that sends no coverage as covering nothing", () => {
    expect(toDeclarationRecord(attestation({ coversRepairLines: null })).repairLineIds).toEqual([])
  })
})
