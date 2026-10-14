// The temporary scale correction on the Overview's money totals.
//
// It divides a portfolio total by 100,000 (price x100 times quantity x1000), labels it an estimate, and
// can be switched off in one place. It must never turn "no figure" into a number, and it must never
// apply on top of an already-correct total when switched off.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { correctMoneyTotal, isCorrectedEstimate, MONEY_SCALE_DIVISOR } from "./source-scale-correction"

describe("correctMoneyTotal", () => {
  it("divides a total by 100,000 when the correction is on", () => {
    expect(MONEY_SCALE_DIVISOR).toBe(100_000)
    expect(correctMoneyTotal(-1_317_618_228_488.6338, true)).toBeCloseTo(-13_176_182.28, 1)
    expect(correctMoneyTotal(400_409_860_446.4529, true)).toBeCloseTo(4_004_098.6, 1)
  })

  it("leaves the total untouched when the correction is switched off", () => {
    expect(correctMoneyTotal(-13_176_182.28, false)).toBe(-13_176_182.28)
  })

  it("keeps 'no figure' as no figure, never a number", () => {
    expect(correctMoneyTotal(null, true)).toBeNull()
    expect(correctMoneyTotal(null, false)).toBeNull()
  })

  it("keeps a real zero as zero", () => {
    expect(correctMoneyTotal(0, true)).toBe(0)
  })
})

describe("isCorrectedEstimate", () => {
  it("is true only for a figure that went through the correction", () => {
    expect(isCorrectedEstimate(5, true)).toBe(true)
    expect(isCorrectedEstimate(5, false)).toBe(false)
    expect(isCorrectedEstimate(null, true)).toBe(false)
  })
})

describe("the Working Capital Impact card", () => {
  function render(workingCapitalOverride: { amount: number | null; currency: string | null; estimated?: boolean }) {
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

  it("shows the corrected amount and calls it an estimate", () => {
    const markup = render({ amount: correctMoneyTotal(-1_317_618_228_488.6338, true), currency: null, estimated: true })
    expect(markup).toContain("−13.18M")
    expect(markup).toContain("Net additional investment · estimate")
    expect(markup).not.toContain("1317618")
  })

  it("does not say estimate when the total was not corrected", () => {
    const markup = render({ amount: -2_500_000, currency: "USD" })
    expect(markup).toContain("−USD 2.50M")
    expect(markup).toContain("Net additional investment")
    expect(markup).not.toContain("estimate")
  })

  it("says estimate for a net release too", () => {
    const markup = render({ amount: 4_004_098.6, currency: null, estimated: true })
    expect(markup).toContain("Net release · estimate")
  })

  it("still says Not available, never an estimate, when there is no figure", () => {
    const markup = render({ amount: null, currency: null, estimated: false })
    expect(markup).toContain("Not available")
    expect(markup).not.toContain("estimate")
  })
})
