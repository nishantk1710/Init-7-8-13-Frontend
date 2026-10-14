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
