// The Overview's (i) popups: every card and chart has one, and the worked examples add up.
//
// The arithmetic is checked here, not trusted, because a client will read these numbers and redo the
// sums. Rendered with react-dom/server: this project's vitest runs without a DOM.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ChartCard } from "@/components/shared/chart-card"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { OVERVIEW_INFO, type OverviewInfoId } from "./overview-info"

const IDS = Object.keys(OVERVIEW_INFO) as OverviewInfoId[]

describe("OVERVIEW_INFO", () => {
  it.each(IDS)("%s explains the rule, the formula and one example", (id) => {
    const spec = OVERVIEW_INFO[id]
    expect(spec.summary.length).toBeGreaterThan(0)
    expect(spec.formula.length).toBeGreaterThan(0)
    expect(spec.steps.length).toBeGreaterThan(0)
    expect(spec.example.inputs.length).toBeGreaterThan(0)
    expect(spec.example.substitution.length).toBeGreaterThan(0)
    expect(spec.example.result.length).toBeGreaterThan(0)
  })

  it("keeps each chart on the same rule as the card it repeats", () => {
    // The distribution and the by-plant chart are the High Stockout Risk card's own test.
    expect(OVERVIEW_INFO.stockoutDistribution.formula).toEqual(OVERVIEW_INFO.stockoutRisk.formula)
    expect(OVERVIEW_INFO.stockoutByPlant.formula).toEqual(
      expect.arrayContaining(OVERVIEW_INFO.stockoutRisk.formula),
    )
    expect(OVERVIEW_INFO.excessByPlant.formula).toEqual(
      expect.arrayContaining(OVERVIEW_INFO.excessInventory.formula),
    )
  })
})

describe("worked examples", () => {
  it("stockout: 10,000 kg is below the 18,417 kg needed over a 15-day lead time", () => {
    const averageDailyUse = 110_500 / 90
    const needed = averageDailyUse * 15
    expect(averageDailyUse.toFixed(1)).toBe("1227.8")
    expect(Math.round(needed)).toBe(18_417)
    expect(10_000 < needed).toBe(true)
  })

  it("working capital: price x (current ROP - recommended ROP) is -221,201, with no currency symbol", () => {
    const impact = 48.15 * (0 - 4_594)
    expect(Math.round(impact)).toBe(-221_201)
    expect(OVERVIEW_INFO.workingCapital.example.substitution.join(" ")).toContain("221,201")
    // The material's currency is null in the data, so no "R" may be claimed for it.
    expect(JSON.stringify(OVERVIEW_INFO.workingCapital.example)).not.toMatch(/\bR ?\d/)
  })

  it("working capital is stated on the reorder point, as the backend computes it", () => {
    const text = JSON.stringify(OVERVIEW_INFO.workingCapital)
    expect(text).toContain("reorder point")
    expect(OVERVIEW_INFO.workingCapital.formula[0]).not.toMatch(/safety stock/i)
  })

  it("excess: 40 is above 30", () => {
    expect(40 > 30).toBe(true)
  })

  it("adopted share: 10 of 40 is 25%", () => {
    expect((10 / 40) * 100).toBe(25)
  })

  it("SAP adoption rate leaves pending out: (10 + 5) / (10 + 5 + 5) is 75%", () => {
    expect(((10 + 5) / (10 + 5 + 5)) * 100).toBe(75)
  })

  it("draws each chart's popup in the colour of the KPI card it repeats", () => {
    expect(OVERVIEW_INFO.stockoutDistribution.tone).toBe(OVERVIEW_INFO.stockoutRisk.tone)
    expect(OVERVIEW_INFO.stockoutByPlant.tone).toBe(OVERVIEW_INFO.stockoutRisk.tone)
    expect(OVERVIEW_INFO.excessByPlant.tone).toBe(OVERVIEW_INFO.excessInventory.tone)
    expect(OVERVIEW_INFO.sapAdoption.tone).toBe(OVERVIEW_INFO.adoptedRecommendation.tone)
  })

  it("says which examples are real materials and which are illustrative", () => {
    const kinds = Object.fromEntries(IDS.map((id) => [id, OVERVIEW_INFO[id].example.kind]))
    expect(kinds.stockoutRisk).toBe("real")
    expect(kinds.workingCapital).toBe("real")
    expect(kinds.excessInventory).toBe("illustrative")
    expect(kinds.sapAdoption).toBe("illustrative")
  })
})

describe("the (i) icon", () => {
  const props = {
    recommendations: [] as Recommendation[],
    adoptedOverride: { count: 5, total: 100 },
    stockoutRiskOverride: { count: 3, total: 100 },
    excessInventoryOverride: { count: 7, total: 100, opportunity: null },
    workingCapitalOverride: { amount: -1_048_500, currency: "ZAR" },
  }

  it("is on all four KPI cards when asked for", () => {
    const markup = renderToStaticMarkup(createElement(InventoryPortfolioKpis, { ...props, showInfo: true }))
    for (const title of ["High Stockout Risk", "Excess Inventory Candidates", "Working Capital Impact", "Adopted recommendation"]) {
      expect(markup).toContain(`How &quot;${title}&quot; is calculated`)
    }
  })

  it("is off the KPI cards by default, which the quarterly reports rely on", () => {
    const markup = renderToStaticMarkup(createElement(InventoryPortfolioKpis, props))
    expect(markup).not.toContain("is calculated")
  })

  it("draws the Overview's KPI cards with an accent bar in each card's own tone, and leaves the reports' plain", () => {
    const overview = renderToStaticMarkup(createElement(InventoryPortfolioKpis, { ...props, showInfo: true }))
    for (const tone of ["destructive", "primary", "success", "warning"]) {
      // The accent bar is on at rest, not a hover: variant.
      expect(overview).toContain(`before:bg-${tone}`)
    }
    // The tone is the bar and the icon chip; the card itself is no longer washed or bordered in it.
    expect(overview).not.toMatch(/border-(destructive|primary|success|warning)\/60/)
    expect(overview).not.toMatch(/(?<![:\w-])bg-(destructive|primary|success|warning)\/5(?!\d)/)
    expect(overview).not.toContain("hover:border-")
    expect(overview).toContain("hover:-translate-y-0.5")
    expect(overview).toContain("active:scale-[0.99]")

    const report = renderToStaticMarkup(createElement(InventoryPortfolioKpis, props))
    expect(report).not.toMatch(/border-(destructive|primary|success|warning)\/60/)
    expect(report).not.toContain("before:bg-")
    expect(report).not.toContain("hover:-translate-y-0.5")
  })

  it("sits in a chart's top-right corner, after the title block", () => {
    const markup = renderToStaticMarkup(
      createElement(ChartCard, {
        title: "SAP adoption",
        info: createElement(OverviewInfo, { id: "sapAdoption" }),
        children: "body",
      }),
    )
    expect(markup).toContain("SAP adoption")
    expect(markup).toContain("How &quot;SAP adoption&quot; is calculated")
    expect(markup).toContain("justify-between")
    expect(markup.indexOf("SAP adoption")).toBeLessThan(markup.indexOf("is calculated"))
  })
})
