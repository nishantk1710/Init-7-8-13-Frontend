// The Recommendations page sends every filter to the backend, so each one searches the whole
// catalogue (tens of thousands of rows) and the footer total follows it. These pin what is sent.

import { afterEach, describe, expect, it, vi } from "vitest"

import { EMPTY_DASHBOARD_FILTERS, type DashboardFilterState } from "@/features/initiative-7/components/dashboard-filters"
import { fetchRecommendations } from "@/features/initiative-7/services/i7-api"
import {
  DEMAND_CLASS_FOR_PATTERN,
  listFilterKey,
  listParamsFromFilters,
  normaliseRecommendationFilters,
  RECOMMENDATIONS_PAGE_FILTERS,
} from "@/features/initiative-7/utils/recommendation-list-query"
import { DEMAND_PATTERNS } from "@/features/initiative-7/types/inventory"

function filters(overrides: Partial<DashboardFilterState> = {}): DashboardFilterState {
  return { ...EMPTY_DASHBOARD_FILTERS, recommendation: "all", ...overrides }
}

afterEach(() => vi.unstubAllGlobals())

describe("listParamsFromFilters", () => {
  it("asks for nothing extra when no filter is set", () => {
    const params = listParamsFromFilters(filters(), 1)
    expect(params).toMatchObject({ page: 1, pageSize: 25, sort: "generated_at", sortDesc: true })
    for (const key of ["status", "plant", "type", "search", "criticalityLevel", "demandClass", "statusGroup", "risk"] as const) {
      expect(params[key]).toBeUndefined()
    }
  })

  it("sends the material box as a search over every recommendation, trimmed", () => {
    expect(listParamsFromFilters(filters({ material: "  8000005029 " }), 1).search).toBe("8000005029")
    expect(listParamsFromFilters(filters({ material: "   " }), 1).search).toBeUndefined()
  })

  it("sends criticality, status and risk as the levels the table shows", () => {
    const params = listParamsFromFilters(
      filters({ criticality: "High", status: "In Approval", risk: "critical", plant: "1300" }),
      3,
    )
    expect(params).toMatchObject({ criticalityLevel: "High", statusGroup: "In Approval", risk: "critical", plant: "1300", page: 3 })
  })

  it("turns each demand pattern in the dropdown into the backend's demand class", () => {
    for (const pattern of DEMAND_PATTERNS) {
      expect(DEMAND_CLASS_FOR_PATTERN[pattern]).toBeTruthy()
      expect(listParamsFromFilters(filters({ demandPattern: pattern }), 1).demandClass).toBe(
        DEMAND_CLASS_FOR_PATTERN[pattern],
      )
    }
    expect(listParamsFromFilters(filters({ demandPattern: "Slow-Moving" }), 1).demandClass).toBe("SLOW")
    expect(listParamsFromFilters(filters({ demandPattern: "Cold start" }), 1).demandClass).toBe("UNCLASSIFIED")
  })

  it("lists only calculated recommendations for OAR / Declining / Normal", () => {
    expect(listParamsFromFilters(filters({ type: "oar" }), 1)).toMatchObject({ type: "oar", status: "READY_FOR_REVIEW" })
  })

  it("sends 'Stock item' as the backend's stock_item group", () => {
    expect(listParamsFromFilters(filters({ type: "stock_item" }), 1)).toMatchObject({
      type: "stock_item",
      status: "READY_FOR_REVIEW",
    })
  })

  it("sends a Min-Max conversion decision only with the OAR group", () => {
    expect(listParamsFromFilters(filters({ type: "oar", conversion: "ELIGIBLE" }), 1).conversionEligibility).toBe("ELIGIBLE")
    expect(listParamsFromFilters(filters({ type: "oar", conversion: "NOT_ELIGIBLE" }), 1).conversionEligibility).toBe("NOT_ELIGIBLE")
    expect(listParamsFromFilters(filters({ type: "oar" }), 1).conversionEligibility).toBeUndefined()
    expect(listParamsFromFilters(filters({ type: "stock_item", conversion: "ELIGIBLE" }), 1).conversionEligibility).toBeUndefined()
  })

  it("sends a confidence only with the OAR group, never alone or with Stock item", () => {
    expect(listParamsFromFilters(filters({ type: "oar", confidence: "HIGH" }), 1).confidence).toBe("HIGH")
    expect(listParamsFromFilters(filters({ type: "oar" }), 1).confidence).toBeUndefined()
    expect(listParamsFromFilters(filters({ type: "stock_item", confidence: "HIGH" }), 1).confidence).toBeUndefined()
    expect(listParamsFromFilters(filters({ confidence: "LOW" }), 1).confidence).toBeUndefined()
  })

  it("lets an explicit status decide instead of forcing 'calculated'", () => {
    const approved = listParamsFromFilters(filters({ type: "oar", status: "Approved" }), 1)
    expect(approved.status).toBeUndefined()
    expect(approved.statusGroup).toBe("Approved")
    // Pending Review keeps the calculated restriction: it would otherwise include not-yet-evaluated rows.
    expect(listParamsFromFilters(filters({ type: "oar", status: "Pending Review" }), 1).status).toBe("READY_FOR_REVIEW")
  })
})

describe("the OAR list is not narrowed by consumption", () => {
  it("never asks the backend to drop OAR materials for low consumption", () => {
    expect(listParamsFromFilters(filters({ type: "oar" }), 1).consumptionAboveThreshold).toBeUndefined()
    expect(listParamsFromFilters(filters({ type: "stock_item" }), 1).consumptionAboveThreshold).toBeUndefined()
  })
})

describe("the list shows only what the SAP adoption counts cover", () => {
  it("asks for actionable recommendations for the non-OAR groups", () => {
    expect(listParamsFromFilters(filters({ type: "stock_item" }), 1).actionable).toBe(true)
    expect(listParamsFromFilters(RECOMMENDATIONS_PAGE_FILTERS, 1).actionable).toBeUndefined()
  })

  it("does not narrow a list with no group chosen", () => {
    expect(listParamsFromFilters(filters(), 1).actionable).toBeUndefined()
  })

  it("lists Not-eligible OAR recommendations alongside the Eligible ones", () => {
    expect(listParamsFromFilters(filters({ type: "oar" }), 1).actionable).toBeUndefined()
    expect(listParamsFromFilters(filters({ type: "oar", conversion: "NOT_ELIGIBLE" }), 1).actionable).toBeUndefined()
    expect(listParamsFromFilters(filters({ type: "oar", conversion: "ELIGIBLE" }), 1).actionable).toBeUndefined()
  })

  it("reaches the backend as actionable=true", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 50 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    await fetchRecommendations(listParamsFromFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item" }, 1))
    expect(new URL(calls[0], "http://x").searchParams.get("actionable")).toBe("true")
  })
})

describe("listFilterKey (decides when paging goes back to page 1)", () => {
  it("changes with any filter that decides which rows exist", () => {
    const base = listFilterKey(filters())
    for (const change of [
      { type: "oar" }, { plant: "1300" }, { criticality: "High" }, { demandPattern: "Lumpy" },
      { status: "Approved" }, { risk: "low" }, { material: "80" }, { confidence: "HIGH" },
    ]) {
      expect(listFilterKey(filters(change))).not.toBe(base)
    }
  })

  it("ignores trailing spaces and the circuit filter, which only narrows the page in view", () => {
    expect(listFilterKey(filters({ material: "80 " }))).toBe(listFilterKey(filters({ material: "80" })))
    expect(listFilterKey(filters({ circuit: "Crushing" }))).toBe(listFilterKey(filters()))
  })
})

describe("the request that reaches the backend", () => {
  it("carries every filter as a query parameter", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 50 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    await fetchRecommendations(
      listParamsFromFilters(
        filters({ material: "valve", criticality: "Low", status: "Returned", risk: "medium", demandPattern: "Lumpy" }),
        2,
      ),
    )
    const query = new URL(calls[0], "http://x").searchParams
    expect(query.get("search")).toBe("valve")
    expect(query.get("criticality_level")).toBe("Low")
    expect(query.get("status_group")).toBe("Returned")
    expect(query.get("risk")).toBe("medium")
    expect(query.get("demand_class")).toBe("LUMPY")
    expect(query.get("page")).toBe("2")
  })
})

describe("the Recommendations page has no All: it is OAR or Stock item", () => {
  it("starts on OAR, so the first request is already an OAR list", () => {
    expect(RECOMMENDATIONS_PAGE_FILTERS.type).toBe("oar")
    expect(listParamsFromFilters(RECOMMENDATIONS_PAGE_FILTERS, 1).type).toBe("oar")
  })

  it("never lets the group go back to All", () => {
    const next = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "all" })
    expect(next.type).toBe("oar")
  })

  it("keeps a valid choice as it is", () => {
    const stock = { ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item" }
    expect(normaliseRecommendationFilters(stock)).toBe(stock)
    const oar = { ...RECOMMENDATIONS_PAGE_FILTERS, confidence: "HIGH" }
    expect(normaliseRecommendationFilters(oar)).toBe(oar)
  })

  it("drops a confidence when the group leaves OAR, so no hidden filter is left behind", () => {
    const next = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item", confidence: "HIGH" })
    expect(next).toMatchObject({ type: "stock_item", confidence: "all" })
  })

  it("lists only calculated recommendations, whichever group is chosen", () => {
    for (const type of ["oar", "stock_item"]) {
      expect(listParamsFromFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type }, 1).status).toBe("READY_FOR_REVIEW")
    }
  })
})

describe("rejecting from the Recommendations page", () => {
  it("posts the reason to the reject endpoint, as the planner, without going through the chain", async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(
        JSON.stringify({
          recommendation_id: "REC-STD-M1-1300", status: "REJECTED", pending_role: null, route: [],
          chain_index: 0, adjustment_count: 0, current_version: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    const { rejectRecommendation } = await import("@/features/initiative-7/services/i7-api")
    const result = await rejectRecommendation("REC-STD-M1-1300", "end-user", "not needed at this plant")
    expect(calls[0].url).toContain("/recommendations/REC-STD-M1-1300/reject")
    expect(calls[0].init?.method).toBe("POST")
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ actor_id: "end-user", comment: "not needed at this plant" })
    expect(result.status).toBe("REJECTED")
  })
})
