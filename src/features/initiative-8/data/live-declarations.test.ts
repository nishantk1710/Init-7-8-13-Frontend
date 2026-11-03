import { describe, expect, it } from "vitest"

import { loadDeclarationLog, toLogRow } from "@/features/initiative-8/data/live-declarations"
import type { ApiAttestation } from "@/lib/api/i8"

/**
 * The declaration log. Since 3-Nov-2026 it is the whole of the Repair
 * Declarations screen: declarations are made in the reservation assistant, and
 * the queue these tests also covered went with the declare buttons.
 */

describe("toLogRow", () => {
  const base: ApiAttestation = {
    id: "ATT-2",
    material: { materialId: "8000000001", materialCode: "8000000001", description: "Pump seal" },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    quantity: "1",
    conditionDescription: "Seal weeping",
    faultCategory: "SEAL_FAILURE",
    recommendation: "REPAIRABLE",
    condition: "Repairable",
    serialNumber: null,
    evidenceReference: null,
    attestor: "unauthenticated",
    attestedAt: "2026-10-27T09:00:00Z",
    sessionId: null,
    supersedes: null,
    supersededBy: null,
    coversRepairLines: null,
    coverageNote: null,
  }

  it("shows the declarer, and on an older record its evidence and amendment reason", () => {
    const row = toLogRow({
      ...base,
      attestorName: "T. Mokoena",
      evidenceReference: "Photo 4411",
      supersedes: "ATT-1",
      amendmentReason: "Wrong fault chosen",
      repairDocument: "4500000001",
      repairItem: "10",
    })
    expect(row.attestor).toBe("T. Mokoena")
    expect(row.evidenceReference).toBe("Photo 4411")
    expect(row.amendmentReason).toBe("Wrong fault chosen")
    expect(row.isAmendment).toBe(true)
    expect(row.repairId).toBe("4500000001-10")
    expect(row.repairDocument).toBe("4500000001")
    expect(row.repairItem).toBe("10")
  })

  it("falls back to the stamped attestor when no name was recorded", () => {
    const row = toLogRow(base)
    expect(row.attestor).toBe("unauthenticated")
    expect(row.evidenceReference).toBeUndefined()
    expect(row.amendmentReason).toBeUndefined()
    expect(row.repairId).toBeUndefined()
  })

  it("a declaration bound to a repair PR keys the register's PR row", () => {
    const row = toLogRow({ ...base, repairDocument: "1000001", repairItem: "10", repairDocumentType: "PR" })
    expect(row.repairId).toBe("PR-1000001-10")
    expect(row.repairDocumentType).toBe("PR")
  })
})

describe("loadDeclarationLog", () => {
  it("is null when the log cannot be read, never an empty log", async () => {
    const { vi } = await import("vitest")
    const api = await import("@/lib/api/i8")
    const spy = vi.spyOn(api, "getAttestations").mockRejectedValueOnce(new Error("down"))
    expect(await loadDeclarationLog()).toBeNull()
    spy.mockRestore()
  })
})
