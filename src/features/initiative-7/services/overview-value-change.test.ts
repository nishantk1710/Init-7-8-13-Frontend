// The Overview's Value Change filter (Stock item): Releases value / Ties up value. Every figure on the page
// is a backend aggregate, so the filter has to reach each call -- the summary (working capital, excess, stockout,
// plant cards) and the adoption summary (the Adopted card).

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  EMPTY_DASHBOARD_FILTERS,
  isDashboardFiltersActive,
  VALUE_CHANGE_OPTIONS,
} from "@/features/initiative-7/components/dashboard-filters"
import { fetchAdoptionSummary, fetchRecommendationSummary } from "@/features/initiative-7/services/i7-api"

afterEach(() => vi.unstubAllGlobals())

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const ADOPTION_BODY = {
  total_evaluated: 0,
  by_status: [],
  adopted_count: 0,
  partially_adopted_count: 0,
  not_adopted_count: 0,
  unknown_count: 0,
  adoption_rate_percentage: null,
}

describe("Value Change on the Overview", () => {
  it("offers Releases value and Ties up value, mapped to the backend's values", () => {
    expect(VALUE_CHANGE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["released", "Releases value"],
      ["tied_up", "Ties up value"],
    ])
  })

  it("starts on All, and counts as an active filter only when changed", () => {
    expect(EMPTY_DASHBOARD_FILTERS.valueChange).toBe("all")
    expect(isDashboardFiltersActive(EMPTY_DASHBOARD_FILTERS)).toBe(false)
    expect(isDashboardFiltersActive({ ...EMPTY_DASHBOARD_FILTERS, valueChange: "released" })).toBe(true)
  })

  it("sends value_change on the summary call (working capital, excess, stockout, plant cards)", async () => {
    const fetchMock = stubFetch({ total: 0, by_status: [], by_criticality: [], by_circuit: [], by_risk: [], by_plant: [] })
    await fetchRecommendationSummary({ isOar: false, valueChange: "released" }).catch(() => undefined)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/recommendations/summary")
    expect(url).toContain("value_change=released")
    expect(url).toContain("is_oar=false")
  })

  it("sends value_change on the adoption summary call (the Adopted card)", async () => {
    const fetchMock = stubFetch(ADOPTION_BODY)
    await fetchAdoptionSummary({ type: "stock_item", valueChange: "tied_up" })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/recommendations/adoption/summary")
    expect(url).toContain("value_change=tied_up")
    expect(url).toContain("type=stock_item")
  })

  it("sends nothing extra when the filter is All", async () => {
    const fetchMock = stubFetch(ADOPTION_BODY)
    await fetchAdoptionSummary({ type: "stock_item" })
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("value_change")
  })
})
