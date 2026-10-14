// The trend cards plot what the backend recorded -- and must never turn "not recorded" into 0.

import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchRecommendationTrends, type RecommendationTrends, type TrendPoint } from "@/features/initiative-7/services/i7-api"
import {
  excessSeries,
  formatTrendDate,
  formatTrendDateTime,
  opportunityCurrency,
  stockoutSeries,
} from "./trend-series"

function point(overrides: Partial<TrendPoint> = {}): TrendPoint {
  return {
    capturedAt: "2026-10-15T02:14:00Z",
    source: "captured",
    totalCount: 100,
    stockoutRiskCount: 7,
    excessCount: 4,
    excessOpportunity: 1000,
    currency: "USD",
    ...overrides,
  }
}

function trends(points: TrendPoint[]): RecommendationTrends {
  return {
    plant: "ALL",
    points,
    hasStockoutHistory: points.some((p) => p.stockoutRiskCount !== null),
    hasExcessHistory: points.length > 0,
    capturedCount: points.filter((p) => p.source === "captured").length,
    reconstructedCount: points.filter((p) => p.source === "reconstructed").length,
    definitionNote: "note",
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("stockoutSeries", () => {
  it("has one point per recorded run, at its real time", () => {
    const series = stockoutSeries(
      trends([point({ capturedAt: "2026-10-15T02:00:00Z" }), point({ capturedAt: "2026-10-17T02:00:00Z", stockoutRiskCount: 9 })]),
    )
    expect(series.map((p) => p.value)).toEqual([7, 9])
    expect(series[1].t - series[0].t).toBe(2 * 24 * 60 * 60 * 1000)
  })

  it("leaves out a point with no recorded stockout count instead of drawing 0", () => {
    const series = stockoutSeries(
      trends([point({ source: "reconstructed", stockoutRiskCount: null }), point({ stockoutRiskCount: 3 })]),
    )
    expect(series).toHaveLength(1)
    expect(series[0].value).toBe(3)
  })

  it("is empty when only reconstructed (stockout-less) history exists", () => {
    expect(stockoutSeries(trends([point({ source: "reconstructed", stockoutRiskCount: null })]))).toEqual([])
  })

  it("keeps a genuine zero: no material-plant at risk is a real value, not a gap", () => {
    expect(stockoutSeries(trends([point({ stockoutRiskCount: 0 })]))[0].value).toBe(0)
  })
})

describe("excessSeries", () => {
  it("keeps a missing opportunity as null (a gap), never zero", () => {
    const series = excessSeries(trends([point({ excessOpportunity: null })]))
    expect(series[0].opportunity).toBeNull()
    expect(series[0].count).toBe(4)
  })

  it("keeps reconstructed points, marked as such", () => {
    const series = excessSeries(trends([point({ source: "reconstructed", stockoutRiskCount: null, currency: null })]))
    expect(series[0].source).toBe("reconstructed")
  })
})

describe("opportunityCurrency", () => {
  it("is the newest currency any point states", () => {
    const series = excessSeries(trends([point({ currency: "USD" }), point({ currency: null })]))
    expect(opportunityCurrency(series)).toBe("USD")
  })

  it("is null when none does, so the card says so instead of guessing a symbol", () => {
    expect(opportunityCurrency(excessSeries(trends([point({ currency: null })])))).toBeNull()
  })
})

describe("date labels", () => {
  it("shows the day on the axis and the real time in the tooltip, in UTC", () => {
    const t = Date.parse("2026-10-15T02:14:00Z")
    expect(formatTrendDate(t)).toBe("15 Oct")
    expect(formatTrendDateTime(t)).toBe("15 Oct 2026, 02:14 UTC")
  })
})

describe("fetchRecommendationTrends", () => {
  function stubFetch(body: unknown) {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url))
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
    })
    return calls
  }

  it("asks for the chosen plant scope and maps the response", async () => {
    const calls = stubFetch({
      plant: "1300",
      points: [
        {
          captured_at: "2026-10-15T02:14:00Z", source: "captured", inventory_run_id: 7, oar_run_id: 3,
          forecast_run_id: 5, feature_run_id: 2, total_count: 100, stockout_risk_count: 7, excess_count: 4,
          excess_opportunity: "1234.5000", net_safety_stock_value_impact: null, currency: "USD",
        },
      ],
      has_stockout_history: true, has_excess_history: true, captured_count: 1, reconstructed_count: 0,
      definition_note: "internal proxy",
    })
    const result = await fetchRecommendationTrends("1300")
    expect(calls[0]).toContain("/recommendations/trends")
    expect(new URL(calls[0], "http://x").searchParams.get("plant")).toBe("1300")
    expect(result.points[0]).toMatchObject({ stockoutRiskCount: 7, excessCount: 4, excessOpportunity: 1234.5, currency: "USD" })
    expect(result.hasStockoutHistory).toBe(true)
  })

  it("keeps null stockout and null opportunity as null", async () => {
    stubFetch({
      plant: "ALL",
      points: [
        {
          captured_at: "2026-10-01T00:00:00Z", source: "reconstructed", inventory_run_id: null, oar_run_id: null,
          forecast_run_id: null, feature_run_id: 1, total_count: 10, stockout_risk_count: null, excess_count: 0,
          excess_opportunity: null, net_safety_stock_value_impact: null, currency: null,
        },
      ],
      has_stockout_history: false, has_excess_history: true, captured_count: 0, reconstructed_count: 1,
      definition_note: "n",
    })
    const result = await fetchRecommendationTrends()
    expect(result.points[0].stockoutRiskCount).toBeNull()
    expect(result.points[0].excessOpportunity).toBeNull()
    expect(result.hasStockoutHistory).toBe(false)
  })
})
