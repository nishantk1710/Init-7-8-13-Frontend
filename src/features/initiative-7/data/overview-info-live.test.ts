// The Overview's (i) popups under edited formulas: the card must describe the rule the numbers are
// computed with, and fall back to the built-in text when nothing has been changed or the formulas
// could not be read.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { OverviewFormulasProvider } from "@/features/initiative-7/components/overview-formulas-context"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import type { ActiveFormulas } from "@/features/initiative-7/types/kpi-formulas"
import { OVERVIEW_INFO, type OverviewInfoId } from "./overview-info"
import { describeSpan, overviewInfoFor } from "./overview-info-live"

const CUSTOM: ActiveFormulas = {
  version: 3,
  isDefault: false,
  windowDays: 60,
  lookbackDays: 365,
  formulaLines: {
    stockout: [
      "Average daily use = units used in the last 60 days ÷ 60",
      "Stock needed = average daily use × lead time (days) × 1.2",
      "At risk when stock on hand < stock needed",
    ],
    excess: ["Excess candidate when current max stock > recommended max stock × 1.1"],
    working_capital: ["Working capital impact = unit price × (current safety stock - recommended safety stock)"],
  },
  examples: {
    stockout: {
      material: "Sodium cyanide (4000000001)",
      plant: "1300",
      inputs: [{ label: "Stock on hand", value: "100" }],
      substitution: ["Stock needed = 5 × 30 × 1.2 = 180", "100 < 180"],
      result: "At risk: stock runs out before a new order could arrive.",
    },
    excess: null,
    working_capital: null,
  },
}

describe("overviewInfoFor", () => {
  it.each(Object.keys(OVERVIEW_INFO) as OverviewInfoId[])("%s is the built-in text when nothing was edited", (id) => {
    expect(overviewInfoFor(id, null)).toBe(OVERVIEW_INFO[id])
    expect(overviewInfoFor(id, { ...CUSTOM, isDefault: true })).toBe(OVERVIEW_INFO[id])
  })

  it("replaces the stockout formula and example on the card and both charts", () => {
    for (const id of ["stockoutRisk", "stockoutDistribution", "stockoutByPlant"] as const) {
      const spec = overviewInfoFor(id, CUSTOM)
      expect(spec.formula).toEqual(expect.arrayContaining(CUSTOM.formulaLines.stockout!))
      expect(spec.example.material).toContain("Sodium cyanide")
      expect(spec.example.kind).toBe("real")
    }
  })

  it("keeps each chart on the same rule as the card it repeats", () => {
    expect(overviewInfoFor("stockoutDistribution", CUSTOM).formula).toEqual(overviewInfoFor("stockoutRisk", CUSTOM).formula)
    expect(overviewInfoFor("excessByPlant", CUSTOM).formula).toEqual(
      expect.arrayContaining(CUSTOM.formulaLines.excess!),
    )
  })

  it("writes the lookback into the rule, not the old two years", () => {
    const steps = overviewInfoFor("stockoutRisk", CUSTOM).steps.join(" ")
    expect(steps).toContain("within 1 year")
    expect(steps).not.toContain("2 years")
  })

  it("says so when no real material fits the new formula, rather than keeping the old example", () => {
    const spec = overviewInfoFor("excessInventory", CUSTOM)
    expect(spec.example.material).toBe("No example available yet")
    expect(spec.example.substitution).toEqual([])
  })

  it("never changes the adoption cards, which have no formula", () => {
    expect(overviewInfoFor("adoptedRecommendation", CUSTOM)).toBe(OVERVIEW_INFO.adoptedRecommendation)
    expect(overviewInfoFor("sapAdoption", CUSTOM)).toBe(OVERVIEW_INFO.sapAdoption)
  })

  it("falls back to the built-in text when the backend sent no lines for a KPI", () => {
    expect(overviewInfoFor("workingCapital", { ...CUSTOM, formulaLines: {} })).toBe(OVERVIEW_INFO.workingCapital)
  })
})

describe("describeSpan", () => {
  it.each([
    [730, "2 years"],
    [365, "1 year"],
    [1095, "3 years"],
    [90, "90 days"],
    [400, "400 days"],
  ])("%i days is %s", (days, text) => {
    expect(describeSpan(days)).toBe(text)
  })
})

describe("OverviewInfo with the formulas provided", () => {
  // The popup is closed until clicked, so only its trigger renders here; this proves the provider and the
  // hook are wired without a DOM, and that a missing provider does not break the icon.
  it("renders the (i) trigger with and without formulas", () => {
    const without = renderToStaticMarkup(createElement(OverviewInfo, { id: "stockoutRisk" }))
    const withFormulas = renderToStaticMarkup(
      createElement(OverviewFormulasProvider, { value: CUSTOM }, createElement(OverviewInfo, { id: "stockoutRisk" })),
    )
    expect(without.length).toBeGreaterThan(0)
    expect(withFormulas.length).toBeGreaterThan(0)
  })
})
