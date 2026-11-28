// The Overview's Value Change filter (Stock item): Releases value / Ties up value. Every figure on the page
// is a backend aggregate, so the filter has to reach each call -- the summary (working capital, excess, stockout,
// plant cards) and the adoption summary (the Adopted card).

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  EMPTY_DASHBOARD_FILTERS,
  isDashboardFiltersActive,
  isValueChangeFilter,
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
  it("offers exactly three views: Release Value, Tie Up Value and Stock Item to OAR", () => {
    expect(VALUE_CHANGE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["released", "Release Value"],
      ["tied_up", "Tie Up Value"],
      ["released_oar_only", "Stock Item to OAR"],
    ])
  })

  it("knows its own values and nothing else", () => {
    for (const value of ["released", "tied_up", "released_oar_only"]) expect(isValueChangeFilter(value)).toBe(true)
    for (const value of ["all", "", "release", "oar", "released_stock_oar", "released_overlap"]) expect(isValueChangeFilter(value)).toBe(false)
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

describe("the Stock Item to OAR view reaches every figure on the page", () => {
  it.each(["released_oar_only"] as const)("sends value_change=%s on the summary call", async (view) => {
    const fetchMock = stubFetch({ total: 0, by_status: [], by_criticality: [], by_circuit: [], by_risk: [], by_plant: [] })
    await fetchRecommendationSummary({ isOar: false, valueChange: view }).catch(() => undefined)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain(`value_change=${view}`)
    expect(url).toContain("is_oar=false")
  })

  it.each(["released_oar_only"] as const)("sends value_change=%s on the adoption summary call", async (view) => {
    const fetchMock = stubFetch(ADOPTION_BODY)
    await fetchAdoptionSummary({ type: "stock_item", valueChange: view })
    expect(String(fetchMock.mock.calls[0][0])).toContain(`value_change=${view}`)
  })

  it("still reads the overlap count an older backend view sends", async () => {
    stubFetch({ total: 0, by_status: [], by_criticality: [], by_circuit: [], by_risk: [], by_plant: [], working_capital_overlap_count: 7 })
    const summary = await fetchRecommendationSummary({ isOar: false, valueChange: "released_oar_only" })
    expect(summary.workingCapitalOverlapCount).toBe(7)
  })

  it("is null from a backend that does not send it (an older one)", async () => {
    stubFetch({ total: 0, by_status: [], by_criticality: [], by_circuit: [], by_risk: [], by_plant: [] })
    expect((await fetchRecommendationSummary({ isOar: false })).workingCapitalOverlapCount).toBeNull()
  })
})

describe("the Overview page and the Working Capital card", () => {
  const read = (relative: string) => readFileSync(join(__dirname, "..", "..", "..", relative), "utf8")
  const workspace = read("features/initiative-7/components/live-overview-workspace.tsx")
  const cards = read("features/initiative-7/components/inventory-portfolio-kpis.tsx")

  it("sends a Value Change view only for Stock item, and any of the three values", () => {
    expect(workspace).toContain('typeParam === "stock_item" && isValueChangeFilter(filters.valueChange)')
  })

  it("passes the same Value Change to the summary, the plant cards and the adoption counts", () => {
    expect(workspace.match(/valueChange: valueChangeParam/g)).toHaveLength(3)
  })

  it("says under the cards what each view counts, in words for all three", () => {
    for (const view of ["released:", "tied_up:", "released_oar_only:"]) expect(workspace).toContain(view)
    expect(workspace).toContain("They are not counted in the other views.")
  })

  it("shows how many materials the overlap view counts in both, next to the coverage", () => {
    expect(cards).toContain("overlapCount?: number | null")
    expect(cards).toContain("counted in both")
  })

  it("does not touch the existing Release and Tie-up wording", () => {
    expect(workspace).toContain("Only materials that release value (reorder point goes down).")
    expect(workspace).toContain("Only materials that tie up value (reorder point goes up).")
  })
})
