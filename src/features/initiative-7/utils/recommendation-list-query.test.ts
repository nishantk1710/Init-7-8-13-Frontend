// The Recommendations page sends every filter to the backend, so each one searches the whole
// catalogue (tens of thousands of rows) and the footer total follows it. These pin what is sent.

import { afterEach, describe, expect, it, vi } from "vitest"

import { EMPTY_DASHBOARD_FILTERS, type DashboardFilterState } from "@/features/initiative-7/components/dashboard-filters"
import { fetchRecommendations } from "@/features/initiative-7/services/i7-api"
import {
  DEMAND_CLASS_FOR_PATTERN,
  listFilterKey,
  listParamsFromFilters,
} from "@/features/initiative-7/utils/recommendation-list-query"
import { DEMAND_PATTERNS } from "@/features/initiative-7/types/inventory"

function filters(overrides: Partial<DashboardFilterState> = {}): DashboardFilterState {
  return { ...EMPTY_DASHBOARD_FILTERS, recommendation: "all", ...overrides }
}

afterEach(() => vi.unstubAllGlobals())

describe("listParamsFromFilters", () => {
  it("asks for nothing extra when no filter is set", () => {
    const params = listParamsFromFilters(filters(), 1)
    expect(params).toMatchObject({ page: 1, pageSize: 50, sort: "generated_at", sortDesc: true })
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

  it("lets an explicit status decide instead of forcing 'calculated'", () => {
    const approved = listParamsFromFilters(filters({ type: "oar", status: "Approved" }), 1)
    expect(approved.status).toBeUndefined()
    expect(approved.statusGroup).toBe("Approved")
    // Pending Review keeps the calculated restriction: it would otherwise include not-yet-evaluated rows.
    expect(listParamsFromFilters(filters({ type: "oar", status: "Pending Review" }), 1).status).toBe("READY_FOR_REVIEW")
  })
})

describe("listFilterKey (decides when paging goes back to page 1)", () => {
  it("changes with any filter that decides which rows exist", () => {
    const base = listFilterKey(filters())
    for (const change of [
      { type: "oar" }, { plant: "1300" }, { criticality: "High" }, { demandPattern: "Lumpy" },
      { status: "Approved" }, { risk: "low" }, { material: "80" },
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
