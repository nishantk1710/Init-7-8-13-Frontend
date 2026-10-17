// The Working Capital Impact KPI reads the backend's portfolio total.
//
// Rendered to static markup with react-dom/server, as report-print-view.test.ts
// does: this project's vitest runs without a DOM.
//
// Before, the KPI summed the rows on the fetched page -- the ~200 newest -- and
// presented that as the portfolio's working-capital impact.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { InventoryPortfolioKpis } from "./inventory-portfolio-kpis"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

function render(workingCapitalOverride?: { amount: number | null; currency: string | null }) {
  return renderToStaticMarkup(
    createElement(InventoryPortfolioKpis, {
      recommendations: [] as Recommendation[],
      pendingApprovalOverride: { count: 5, total: 100 },
      stockoutRiskOverride: { count: 3, total: 100 },
      excessInventoryOverride: { count: 7, total: 100, opportunity: null },
      workingCapitalOverride,
    }),
  )
}

describe("High Stockout Risk KPI", () => {
  it("is titled High Stockout Risk, not Critical", () => {
    const markup = render(undefined)
    expect(markup).toContain("High Stockout Risk")
    expect(markup).not.toContain("Critical Stockout Risk")
  })
})

describe("Working Capital Impact KPI", () => {
  it("shows the backend's portfolio net release, not a sum of the fetched rows", () => {
    const markup = render({ amount: 2_500_000, currency: "USD" })
    expect(markup).toContain("Working Capital Impact")
    expect(markup).toContain("+USD 2.50M")
    expect(markup).toContain("Net release")
  })

  it("says it is additional investment when the total is negative", () => {
    const markup = render({ amount: -1_200_000, currency: "USD" })
    expect(markup).toContain("−USD 1.20M")
    expect(markup).toContain("Net additional investment")
  })

  it("says Not available, never 0, when the backend has no figure", () => {
    const markup = render({ amount: null, currency: null })
    expect(markup).toContain("Not available")
    expect(markup).toContain("needs a unit price and a calculated safety stock")
    expect(markup).not.toContain("Net release")
  })

  it("still works for callers that pass no override (the scenario dataset)", () => {
    expect(render(undefined)).toContain("Working Capital Impact")
  })
})

describe("High Stockout Risk KPI", () => {
  function renderStockout(stockoutRiskOverride?: {
    count: number
    total: number
    insufficient?: number
    asOf?: string | null
  }) {
    return renderToStaticMarkup(
      createElement(InventoryPortfolioKpis, {
        recommendations: [] as Recommendation[],
        pendingApprovalOverride: { count: 5, total: 100 },
        stockoutRiskOverride,
        excessInventoryOverride: { count: 7, total: 100, opportunity: null },
        workingCapitalOverride: { amount: null, currency: null },
      }),
    )
  }

  it("shows the at-risk count, its share of the evaluated material-plants, and the date it is as of", () => {
    const markup = renderStockout({ count: 25, total: 200, insufficient: 0, asOf: "2026-05-31" })
    expect(markup).toContain("As of 31 May 2026")
    expect(markup).toContain("12.5% of evaluated") // 25 of 200, not of everything
    expect(markup).not.toContain("12.5% of in-scope")
  })

  it("counts the material-plants that could not be judged, separately, so they never look safe", () => {
    const markup = renderStockout({ count: 25, total: 200, insufficient: 1234, asOf: "2026-05-31" })
    expect(markup).toContain("As of 31 May 2026 · 1,234 need data")
  })

  it("leaves the need-data count out when every material-plant could be judged", () => {
    expect(renderStockout({ count: 25, total: 200, insufficient: 0, asOf: "2026-05-31" })).not.toContain("need data")
  })

  it("says Not available, never 0, when the usage it is built from has not been built", () => {
    const markup = renderStockout({ count: 0, total: 0, insufficient: 0, asOf: null })
    expect(markup).toContain("Not available")
    expect(markup).toContain("needs the stockout usage build")
    expect(markup).not.toContain("As of")
    expect(markup).not.toContain("of evaluated")
  })

  it("keeps the old wording for a caller with no backend figures (the scenario dataset)", () => {
    const markup = renderStockout(undefined)
    expect(markup).toContain("of in-scope")
    expect(markup).not.toContain("As of")
  })
})
