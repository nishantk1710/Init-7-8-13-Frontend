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
      adoptedOverride: { count: 5, total: 100 },
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

describe("High Stockout Risk KPI without a backend figure", () => {
  // Only what the four cards read: the risk, a status, the stock figures and the money.
  const rows = ["critical", "high", "low"].map((risk) => ({
    risk,
    status: "Approved",
    current: { rop: 0, safetyStock: 0, maxStock: 0 },
    recommended: { rop: 0, safetyStock: 0, maxStock: 0 },
    impact: { workingCapital: 0 },
  })) as unknown as Recommendation[]
  const renderWith = (unavailable: string) =>
    renderToStaticMarkup(
      createElement(InventoryPortfolioKpis, { recommendations: rows, stockoutRiskUnavailable: unavailable }),
    )

  it("says Not available and why, instead of counting the rows it was given", () => {
    const markup = renderWith("loading…")
    expect(markup).toContain("Not available")
    expect(markup).toContain("loading…")
    expect(markup).not.toContain("66.7") // 2 of those 3 rows would otherwise read as 66.7%
  })

  it("keeps the as-of note off a figure that is not there", () => {
    expect(renderWith("could not be loaded from the backend")).not.toContain("As of")
  })

  it("still counts the rows for the scenario dataset, which passes neither prop", () => {
    expect(renderToStaticMarkup(createElement(InventoryPortfolioKpis, { recommendations: rows }))).toContain(
      "66.7% of in-scope",
    )
  })
})

describe("Adopted recommendation KPI", () => {
  const renderAdopted = (adoptedOverride?: { count: number; total: number } | null) =>
    renderToStaticMarkup(createElement(InventoryPortfolioKpis, { recommendations: [] as Recommendation[], adoptedOverride }))

  it("replaces Pending Approval: x adopted of y recommendations, and the share", () => {
    const markup = renderAdopted({ count: 12, total: 400 })
    expect(markup).toContain("Adopted recommendation")
    expect(markup).not.toContain("Pending Approval")
    expect(markup).toContain(">12<")
    expect(markup).toContain("of 400 recommendations")
    expect(markup).toContain("3.0% adopted")
  })

  it("reads 0 of y, not Not available, when there is something to adopt and none has been", () => {
    const markup = renderAdopted({ count: 0, total: 400 })
    expect(markup).toContain("of 400 recommendations")
    expect(markup).toContain("0.0% adopted")
  })

  it("says Not available, never 0, when the adoption counts could not be loaded", () => {
    const markup = renderAdopted(null)
    expect(markup).toContain("Adopted recommendation")
    expect(markup).toContain("adoption counts could not be loaded")
    expect(markup).not.toContain("% adopted")
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
    expect(markup).toContain("needs a unit price and a calculated reorder point")
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
        adoptedOverride: { count: 5, total: 100 },
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
