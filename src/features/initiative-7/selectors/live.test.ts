import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  fetchRecommendationSummary: vi.fn(),
  fetchRecommendations: vi.fn(),
  fetchApprovalEvents: vi.fn(),
}))
vi.mock("@/features/initiative-7/services/i7-api", () => api)

import {
  getInitiative7LiveActions,
  getInitiative7LiveAuditEvents,
  getInitiative7LiveSummary,
} from "@/features/initiative-7/selectors/live"

function stats(overrides: Record<string, unknown> = {}) {
  return {
    criticalStockoutRiskCount: 5,
    stockoutRiskEvaluatedCount: 20,
    stockoutRiskInsufficientDataCount: 2,
    stockoutRiskAsOf: "2026-05-31",
    excessInventoryCandidatesCount: 3,
    awaitingApprovalCount: 7,
    netSafetyStockValueImpact: -1_048_500,
    currency: "ZAR",
    ...overrides,
  }
}

function rec(id: string, material: string, plant: string, risk = "high") {
  return {
    id,
    material: { materialId: material, materialCode: material, description: `Part ${material}` },
    plantId: plant,
    risk,
    generatedAt: "2026-09-20T08:00:00Z",
  }
}

/** Serve each status bucket from a table; an unlisted status is an empty bucket. */
function serve(buckets: Record<string, { rows: ReturnType<typeof rec>[]; total?: number }>) {
  api.fetchRecommendations.mockImplementation(async ({ status }: { status: string }) => {
    const bucket = buckets[status] ?? { rows: [] }
    return { recommendations: bucket.rows, total: bucket.total ?? bucket.rows.length, page: 1, pageSize: 50 }
  })
}

beforeEach(() => {
  api.fetchRecommendationSummary.mockReset()
  api.fetchRecommendations.mockReset()
  api.fetchApprovalEvents.mockReset()
})

describe("getInitiative7LiveSummary", () => {
  it("reads the four card figures straight from the summary endpoint", async () => {
    api.fetchRecommendationSummary.mockResolvedValue(stats())
    const s = await getInitiative7LiveSummary()
    expect(s.metrics.map((m) => [m.label, m.value])).toEqual([
      ["Materials at stockout risk", 5],
      ["Excess inventory candidates", 3],
      ["Awaiting approval", 7],
      ["Net working-capital impact", expect.stringContaining("1")],
    ])
    expect(api.fetchRecommendationSummary).toHaveBeenCalledTimes(1)
  })

  it("says the impact is not available when the backend has none, never zero", async () => {
    api.fetchRecommendationSummary.mockResolvedValue(stats({ netSafetyStockValueImpact: null }))
    const impact = (await getInitiative7LiveSummary()).metrics[3]
    expect(impact.value).toBe("Not available")
  })

  it("marks the sign of the impact", async () => {
    api.fetchRecommendationSummary.mockResolvedValue(stats({ netSafetyStockValueImpact: 5000 }))
    expect(String((await getInitiative7LiveSummary()).metrics[3].value)).toMatch(/^\+/)
    api.fetchRecommendationSummary.mockResolvedValue(stats({ netSafetyStockValueImpact: -5000 }))
    expect(String((await getInitiative7LiveSummary()).metrics[3].value)).toMatch(/^−/)
  })

  it("derives health from the counts: critical, then attention, then healthy", async () => {
    api.fetchRecommendationSummary.mockResolvedValue(stats())
    expect((await getInitiative7LiveSummary()).health).toBe("critical")
    api.fetchRecommendationSummary.mockResolvedValue(stats({ criticalStockoutRiskCount: 0 }))
    expect((await getInitiative7LiveSummary()).health).toBe("attention")
    api.fetchRecommendationSummary.mockResolvedValue(
      stats({ criticalStockoutRiskCount: 0, excessInventoryCandidatesCount: 0, awaitingApprovalCount: 0 })
    )
    expect((await getInitiative7LiveSummary()).health).toBe("healthy")
  })

  it("throws when the endpoint fails, so the caller can render a failed card", async () => {
    api.fetchRecommendationSummary.mockRejectedValue(new Error("503"))
    await expect(getInitiative7LiveSummary()).rejects.toThrow("503")
  })
})

describe("getInitiative7LiveActions", () => {
  it("asks for the newest rows of each status, capped, rather than the whole table", async () => {
    serve({})
    await getInitiative7LiveActions()
    const calls = api.fetchRecommendations.mock.calls.map(([p]) => p)
    expect(calls.map((c) => c.status)).toEqual([
      "PENDING_APPROVAL",
      "READY_FOR_REVIEW",
      "SENT_BACK",
      "HELD",
      "ADJUSTED",
    ])
    for (const c of calls) expect(c).toMatchObject({ pageSize: 50, sort: "generated_at", sortDesc: true })
  })

  it("decides what is a decision from the status, not from the wording of a title", async () => {
    serve({
      PENDING_APPROVAL: { rows: [rec("R1", "M1", "1300")] },
      READY_FOR_REVIEW: { rows: [rec("R2", "M2", "1300")] },
      SENT_BACK: { rows: [rec("R3", "M3", "1300")] },
      HELD: { rows: [rec("R4", "M4", "1300")] },
      ADJUSTED: { rows: [rec("R5", "M5", "1300")] },
    })
    const result = await getInitiative7LiveActions()
    expect(result.actions).toHaveLength(5)
    expect(result.decisions.map((d) => d.entityId)).toEqual(["R1", "R2", "R3"])
  })

  it("lists a material-plant once even when repeated pipeline runs left several rows", async () => {
    serve({
      PENDING_APPROVAL: { rows: [rec("R1", "M1", "1300"), rec("R1b", "M1", "1300")] },
      READY_FOR_REVIEW: { rows: [rec("R1c", "M1", "1300"), rec("R9", "M1", "1500")] },
    })
    const result = await getInitiative7LiveActions()
    expect(result.actions.map((a) => a.entityId)).toEqual(["R1", "R9"])
  })

  it("reports the real population and says when the list is only a slice", async () => {
    serve({
      PENDING_APPROVAL: { rows: [rec("R1", "M1", "1300")], total: 4200 },
      READY_FOR_REVIEW: { rows: [rec("R2", "M2", "1300")], total: 1 },
      HELD: { rows: [rec("R3", "M3", "1300")], total: 10 },
    })
    const result = await getInitiative7LiveActions()
    expect(result.total).toBe(4211)
    // HELD is open but is not a decision, so it stays out of the decision count.
    expect(result.decisionTotal).toBe(4201)
    expect(result.capped).toBe(true)
  })

  it("is not capped when every bucket came back whole", async () => {
    serve({ PENDING_APPROVAL: { rows: [rec("R1", "M1", "1300")] } })
    expect((await getInitiative7LiveActions()).capped).toBe(false)
  })

  it("maps risk to severity and links to the recommendation", async () => {
    serve({
      PENDING_APPROVAL: {
        rows: [rec("R1", "M1", "1300", "critical"), rec("R2", "M2", "1300", "high"), rec("R3", "M3", "1300", "low")],
      },
    })
    const { actions } = await getInitiative7LiveActions()
    expect(actions.map((a) => a.severity)).toEqual(["critical", "warning", "info"])
    // Waiting on an approver, so it opens in review mode, where it is decided.
    expect(actions[0].href).toBe("/inventory-planning/recommendations/R1?review=1")
    expect(actions[0].createdAt).toBe("2026-09-20T08:00:00Z")
  })

  it("opens approver-waiting items in review mode, and items nobody has sent yet as a plain recommendation", async () => {
    serve({
      PENDING_APPROVAL: { rows: [rec("P1", "M1", "1300", "low")] },
      SENT_BACK: { rows: [rec("S1", "M2", "1300", "low")] },
      HELD: { rows: [rec("H1", "M3", "1300", "low")] },
      READY_FOR_REVIEW: { rows: [rec("N1", "M4", "1300", "low")] },
    })
    const { actions } = await getInitiative7LiveActions()
    const href = (id: string) => actions.find((a) => a.entityId === id)?.href
    expect(href("P1")).toBe("/inventory-planning/recommendations/P1?review=1")
    expect(href("S1")).toBe("/inventory-planning/recommendations/S1?review=1")
    expect(href("H1")).toBe("/inventory-planning/recommendations/H1?review=1")
    expect(href("N1")).toBe("/inventory-planning/recommendations/N1")
  })

  it("throws if any bucket fails rather than returning a partial list as complete", async () => {
    api.fetchRecommendations.mockRejectedValue(new Error("timeout"))
    await expect(getInitiative7LiveActions()).rejects.toThrow("timeout")
  })
})

describe("getInitiative7LiveAuditEvents", () => {
  it("forwards the paging and date bounds", async () => {
    api.fetchApprovalEvents.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 })
    await getInitiative7LiveAuditEvents({ limit: 25, fromTs: "2026-09-01T00:00:00Z", toTs: "2026-09-08T00:00:00Z" })
    expect(api.fetchApprovalEvents).toHaveBeenCalledWith({
      limit: 25,
      fromTs: "2026-09-01T00:00:00Z",
      toTs: "2026-09-08T00:00:00Z",
    })
  })

  it("turns a ledger row into an audit event with a readable description", async () => {
    api.fetchApprovalEvents.mockResolvedValue({
      total: 12,
      limit: 25,
      offset: 0,
      items: [
        {
          recommendation_id: "REC-7",
          recommendation_version: 2,
          actor_id: "U-004",
          actor_role: "Plant Head",
          action: "APPROVE",
          previous_status: "PENDING_APPROVAL",
          new_status: "APPROVED",
          comment: "Within budget",
          timestamp: "2026-09-20T08:00:00Z",
        },
      ],
    })
    const { events, total } = await getInitiative7LiveAuditEvents({ limit: 25 })
    expect(total).toBe(12)
    expect(events[0]).toMatchObject({
      initiative: "initiative-7",
      entityId: "REC-7",
      eventType: "Approved",
      actor: "U-004",
      timestamp: "2026-09-20T08:00:00Z",
    })
    expect(events[0].description).toContain("Plant Head")
    expect(events[0].description).toContain("pending approval → approved")
    expect(events[0].description).toContain("Within budget")
  })

  it("leaves out the status move when a hold did not change the status", async () => {
    api.fetchApprovalEvents.mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          recommendation_id: "REC-7",
          recommendation_version: 1,
          actor_id: "U-004",
          actor_role: "Plant Head",
          action: "HOLD",
          previous_status: "HELD",
          new_status: "HELD",
          comment: null,
          timestamp: "2026-09-20T08:00:00Z",
        },
      ],
    })
    const { events } = await getInitiative7LiveAuditEvents({ limit: 25 })
    expect(events[0].eventType).toBe("Placed on hold")
    expect(events[0].description).not.toContain("→")
  })

  it("gives each event its own id so rows are never collapsed", async () => {
    const row = {
      recommendation_id: "REC-7",
      recommendation_version: 1,
      actor_id: "U",
      actor_role: "End User",
      previous_status: "PENDING_APPROVAL",
      new_status: "APPROVED",
      comment: null,
    }
    api.fetchApprovalEvents.mockResolvedValue({
      total: 2,
      limit: 25,
      offset: 0,
      items: [
        { ...row, action: "APPROVE", timestamp: "2026-09-20T08:00:00Z" },
        { ...row, action: "APPROVE", timestamp: "2026-09-20T09:00:00Z" },
      ],
    })
    const { events } = await getInitiative7LiveAuditEvents({ limit: 25 })
    expect(new Set(events.map((e) => e.id)).size).toBe(2)
  })
})
