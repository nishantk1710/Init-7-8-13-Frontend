// The two trend cards' states: loading, error, no history, and a chart with its honest notes.
//
// Rendered to static markup with react-dom/server (this project's vitest runs without a DOM).
// The chart itself needs a browser layout, so these read the text around it -- which is where
// the promises are: no history is said plainly, estimates are called estimates, rebuilt points are
// declared, and nothing shows a zero for a day nothing was recorded.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ExcessTrendView, StockoutTrendView } from "./recommendation-trend-cards"
import type { RecommendationTrendsState } from "@/features/initiative-7/hooks/use-recommendation-trends"
import type { RecommendationTrends, TrendPoint } from "@/features/initiative-7/services/i7-api"

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

function loaded(points: TrendPoint[]): RecommendationTrendsState {
  const data: RecommendationTrends = {
    plant: "ALL",
    points,
    hasStockoutHistory: points.some((p) => p.stockoutRiskCount !== null),
    hasExcessHistory: points.length > 0,
    capturedCount: points.filter((p) => p.source === "captured").length,
    reconstructedCount: points.filter((p) => p.source === "reconstructed").length,
    definitionNote: "n",
  }
  return { data, loading: false, error: null }
}

const render = (view: typeof StockoutTrendView, state: RecommendationTrendsState) =>
  renderToStaticMarkup(createElement(view, { state }))

describe("loading and error are separate from empty", () => {
  it("shows neither an empty message nor a chart while loading", () => {
    for (const view of [StockoutTrendView, ExcessTrendView]) {
      const markup = render(view, { data: null, loading: true, error: null })
      expect(markup).not.toContain("No ")
      expect(markup).not.toContain("Could not load")
    }
  })

  it("says it could not load, with the reason, and does not say there is no history", () => {
    const state = { data: null, loading: false, error: new Error("backend answered 503") }
    expect(render(StockoutTrendView, state)).toContain("Could not load the stockout risk history")
    expect(render(StockoutTrendView, state)).toContain("backend answered 503")
    expect(render(StockoutTrendView, state)).not.toContain("No stockout history yet")
    expect(render(ExcessTrendView, state)).toContain("Could not load the excess inventory history")
  })
})

describe("Stockout risk trend", () => {
  it("says history has not started yet, and why earlier days cannot be shown", () => {
    const markup = render(StockoutTrendView, loaded([]))
    expect(markup).toContain("No stockout history yet")
    expect(markup).toContain("was not saved")
    expect(markup).toContain("not applied to them")
  })

  it("is still empty when only reconstructed points exist (they carry no stockout count)", () => {
    const markup = render(StockoutTrendView, loaded([point({ source: "reconstructed", stockoutRiskCount: null })]))
    expect(markup).toContain("No stockout history yet")
  })

  it("shows the definition note once there is a recorded point, without any made-up zero", () => {
    const markup = render(StockoutTrendView, loaded([point()]))
    expect(markup).not.toContain("No stockout history yet")
    expect(markup).toContain("below the recommended reorder point")
    expect(markup).toContain("not yet confirmed by the business")
  })
})

describe("Excess inventory trend", () => {
  it("says there is no history yet when nothing was recorded", () => {
    expect(render(ExcessTrendView, loaded([]))).toContain("No excess inventory history yet")
  })

  it("calls the opportunity an estimate and not confirmed savings", () => {
    const markup = render(ExcessTrendView, loaded([point()]))
    expect(markup).toContain("An estimate, not confirmed savings")
    expect(markup).toContain("Estimated opportunity (USD)")
    expect(markup).not.toContain("currency is not stated")
  })

  it("says when the currency is not stated instead of guessing a symbol", () => {
    const markup = render(ExcessTrendView, loaded([point({ currency: null })]))
    expect(markup).toContain("The currency is not stated for these points")
    expect(markup).not.toMatch(/Estimated opportunity \([A-Z]{3}\)/)
  })

  it("declares rebuilt points as rebuilt, in the singular and the plural", () => {
    const one = render(ExcessTrendView, loaded([point({ source: "reconstructed", stockoutRiskCount: null }), point()]))
    expect(one).toContain("1 earlier point was rebuilt from stored recommendations")
    const two = render(
      ExcessTrendView,
      loaded([point({ source: "reconstructed" }), point({ source: "reconstructed" }), point()]),
    )
    expect(two).toContain("2 earlier points were rebuilt")
  })

  it("says nothing about rebuilt points when every point was recorded at the time", () => {
    expect(render(ExcessTrendView, loaded([point(), point()]))).not.toContain("rebuilt")
  })
})
