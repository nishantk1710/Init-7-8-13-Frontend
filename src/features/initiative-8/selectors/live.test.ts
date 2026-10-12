import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  getDeclarations: vi.fn(),
  getRegister: vi.fn(),
  getAttestations: vi.fn(),
}))

vi.mock("@/lib/api/i8", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/i8")>()),
  ...api,
}))

// The real adapter needs a fully populated wire row; these tests are about what
// the selector does with the result, so it is replaced with the few fields the
// selector and its status helpers read.
vi.mock("@/features/initiative-8/data/live-register", () => ({
  toRepairChain: (row: Record<string, unknown>) => ({
    material: { materialCode: (row.material as { materialCode: string }).materialCode },
    overdueStatus: row.overdueStatus,
    daysRemainingInRepair: row.daysRemainingInRepair,
    vendorName: row.vendorName,
    repairStatus: "At Vendor",
  }),
}))

import {
  getInitiative8LiveActions,
  getInitiative8LiveAuditEvents,
  getInitiative8LiveSummary,
} from "@/features/initiative-8/selectors/live"

function snapshot(register: Record<string, number> = {}) {
  return { repairRegister: { openLines: 600, overdueLines: 40, ...register } }
}

function declarationsPage(byStatus: Record<string, number>, items: unknown[] = [], total = items.length) {
  return { items, total, meta: { total, byStatus, outstanding: 0, attestationWindowDays: 90 } }
}

function declaration(id: string, status: "Required" | "Flagged", createdAt: string | null = "2026-09-01") {
  return {
    id,
    status,
    pr: { type: "PR", documentNumber: "2000028376", line: null },
    material: { materialId: "8000004665", materialCode: "8000004665", description: null },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    createdAt,
  }
}

function repairRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    material: { materialId: "8000001111", materialCode: "8000001111", description: null },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    raisedAt: "2025-04-07",
    overdueStatus: "OVERDUE",
    daysRemainingInRepair: -14,
    vendorName: "Bosch Rexroth",
    ...overrides,
  }
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
})

describe("getInitiative8LiveSummary", () => {
  it("reads the register counts from the snapshot and the declaration counts from the queue", async () => {
    api.getSnapshot.mockResolvedValue(snapshot())
    api.getDeclarations.mockResolvedValue(declarationsPage({ Required: 4, Flagged: 1, Completed: 9 }))
    const s = await getInitiative8LiveSummary()
    expect(s.metrics.map((m) => [m.label, m.value])).toEqual([
      ["Active repair chains", 600],
      ["Overdue repairs", 40],
      ["Pending declarations", 4],
      ["Flagged declarations", 1],
    ])
  })

  it("asks the declaration queue for its counts only, not its rows", async () => {
    api.getSnapshot.mockResolvedValue(snapshot())
    api.getDeclarations.mockResolvedValue(declarationsPage({}))
    await getInitiative8LiveSummary()
    expect(api.getDeclarations).toHaveBeenCalledWith({ pageSize: 1 })
  })

  it("says the declaration counts could not be loaded rather than showing zero", async () => {
    api.getSnapshot.mockResolvedValue(snapshot())
    api.getDeclarations.mockRejectedValue(new Error("queue unreachable"))
    const s = await getInitiative8LiveSummary()
    expect(s.metrics[2].value).toBe("Could not be loaded")
    expect(s.metrics[3].value).toBe("Could not be loaded")
  })

  it("does not read as healthy when the declaration queue could not be checked", async () => {
    api.getSnapshot.mockResolvedValue(snapshot({ overdueLines: 0 }))
    api.getDeclarations.mockRejectedValue(new Error("down"))
    expect((await getInitiative8LiveSummary()).health).toBe("attention")
  })

  it("is critical when any declaration is flagged", async () => {
    api.getSnapshot.mockResolvedValue(snapshot({ overdueLines: 0 }))
    api.getDeclarations.mockResolvedValue(declarationsPage({ Flagged: 1 }))
    expect((await getInitiative8LiveSummary()).health).toBe("critical")
  })

  it("is healthy only when nothing is overdue, flagged or piling up", async () => {
    api.getSnapshot.mockResolvedValue(snapshot({ overdueLines: 0 }))
    api.getDeclarations.mockResolvedValue(declarationsPage({ Required: 2 }))
    expect((await getInitiative8LiveSummary()).health).toBe("healthy")
  })

  it("throws when the snapshot fails, since there is no card without it", async () => {
    api.getSnapshot.mockRejectedValue(new Error("snapshot down"))
    api.getDeclarations.mockResolvedValue(declarationsPage({}))
    await expect(getInitiative8LiveSummary()).rejects.toThrow("snapshot down")
  })
})

describe("getInitiative8LiveActions", () => {
  it("treats every outstanding declaration as a decision and an overdue repair as chasing only", async () => {
    api.getDeclarations.mockResolvedValue(
      declarationsPage({}, [declaration("D1", "Flagged"), declaration("D2", "Required")])
    )
    api.getRegister.mockResolvedValue({ items: [repairRow("4500001052-1310")], total: 1 })

    const result = await getInitiative8LiveActions()

    expect(result.decisions.map((a) => a.entityId)).toEqual(["D1", "D2"])
    expect(result.actions.map((a) => a.entityId)).toEqual(["D1", "D2", "4500001052-1310"])
    expect(result.decisionTotal).toBe(2)
    expect(result.total).toBe(3)
  })

  it("makes a flagged declaration critical and a required one a warning", async () => {
    api.getDeclarations.mockResolvedValue(
      declarationsPage({}, [declaration("D1", "Flagged"), declaration("D2", "Required")])
    )
    api.getRegister.mockResolvedValue({ items: [], total: 0 })
    const { decisions } = await getInitiative8LiveActions()
    expect(decisions.map((a) => a.severity)).toEqual(["critical", "warning"])
    expect(decisions[0].title).toContain("flagged")
    expect(decisions[1].title).toContain("required")
  })

  it("keeps dates as ISO and shows no date rather than inventing one when there is none", async () => {
    api.getDeclarations.mockResolvedValue(
      declarationsPage({}, [declaration("D1", "Required", null)])
    )
    api.getRegister.mockResolvedValue({ items: [repairRow("R1")], total: 1 })
    const { actions } = await getInitiative8LiveActions()
    expect(actions[0].createdAt).toBe("")
    expect(actions[1].createdAt).toBe("2025-04-07")
  })

  it("asks only for outstanding declarations and overdue open repairs, capped", async () => {
    api.getDeclarations.mockResolvedValue(declarationsPage({}))
    api.getRegister.mockResolvedValue({ items: [], total: 0 })
    await getInitiative8LiveActions()
    expect(api.getDeclarations).toHaveBeenCalledWith({ outstandingOnly: true, pageSize: 100 })
    expect(api.getRegister).toHaveBeenCalledWith({ overdueOnly: true, openOnly: true, pageSize: 100 })
  })

  it("names the vendor and the days overdue on a repair action", async () => {
    api.getDeclarations.mockResolvedValue(declarationsPage({}))
    api.getRegister.mockResolvedValue({ items: [repairRow("R1")], total: 1 })
    const [action] = (await getInitiative8LiveActions()).actions
    expect(action.title).toContain("Bosch Rexroth")
    expect(action.title).toContain("14 days overdue")
    expect(action.severity).toBe("critical")
    expect(action.href).toBe("/repairable-spares/repair-register/R1")
  })

  it("says it is a slice when the backend holds more than came back", async () => {
    api.getDeclarations.mockResolvedValue(declarationsPage({}, [declaration("D1", "Required")], 450))
    api.getRegister.mockResolvedValue({ items: [], total: 0 })
    const result = await getInitiative8LiveActions()
    expect(result.capped).toBe(true)
    expect(result.decisionTotal).toBe(450)
  })

  it("throws if either source fails rather than returning half the picture", async () => {
    api.getDeclarations.mockResolvedValue(declarationsPage({}))
    api.getRegister.mockRejectedValue(new Error("register down"))
    await expect(getInitiative8LiveActions()).rejects.toThrow("register down")
  })
})

describe("getInitiative8LiveAuditEvents", () => {
  function attestation(id: string, attestedAt: string, supersedes: string | null = null) {
    return {
      id,
      material: { materialId: "8000004665", materialCode: "8000004665", description: null },
      condition: "Repairable",
      faultCategory: "Seal wear",
      attestor: "VZIREQ01",
      attestedAt,
      supersedes,
    }
  }

  it("turns attestations into audit events, attributed to who recorded them", async () => {
    api.getAttestations.mockResolvedValue({
      items: [attestation("A1", "2026-09-10T08:00:00Z"), attestation("A2", "2026-09-11T08:00:00Z", "A1")],
      total: 2,
    })
    const { events } = await getInitiative8LiveAuditEvents({ limit: 25 })
    expect(events.map((e) => e.eventType)).toEqual(["Declaration Recorded", "Declaration Amended"])
    expect(events[0]).toMatchObject({ initiative: "initiative-8", actor: "VZIREQ01", entityId: "A1" })
    expect(events[0].description).toContain("not posted to SAP")
  })

  it("applies the date bounds itself, since the route takes none: from inclusive, to exclusive", async () => {
    api.getAttestations.mockResolvedValue({
      items: [
        attestation("before", "2026-08-31T23:59:59Z"),
        attestation("at-from", "2026-09-01T00:00:00Z"),
        attestation("inside", "2026-09-05T00:00:00Z"),
        attestation("at-to", "2026-09-08T00:00:00Z"),
      ],
      total: 4,
    })
    const { events, total } = await getInitiative8LiveAuditEvents({
      limit: 25,
      fromTs: "2026-09-01T00:00:00Z",
      toTs: "2026-09-08T00:00:00Z",
    })
    expect(events.map((e) => e.entityId)).toEqual(["at-from", "inside"])
    expect(total).toBe(2)
  })

  it("honours the limit but still reports the whole filtered population", async () => {
    api.getAttestations.mockResolvedValue({
      items: [attestation("A1", "2026-09-10T08:00:00Z"), attestation("A2", "2026-09-11T08:00:00Z")],
      total: 2,
    })
    const { events, total } = await getInitiative8LiveAuditEvents({ limit: 1 })
    expect(events).toHaveLength(1)
    expect(total).toBe(2)
  })

  it("does not include SAP document dates from the register as audit events", async () => {
    api.getAttestations.mockResolvedValue({ items: [], total: 0 })
    await getInitiative8LiveAuditEvents({ limit: 25 })
    expect(api.getRegister).not.toHaveBeenCalled()
  })
})
