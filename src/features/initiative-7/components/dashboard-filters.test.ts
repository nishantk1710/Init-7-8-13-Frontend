// The Stockout Risk filter on the Overview offers High, Medium and Low; High takes Critical with it.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  ALL_FILTER,
  CONFIDENCE_OPTIONS,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  isDashboardFiltersActive,
  matchesRiskFilter,
  RECOMMENDATION_TYPE_OPTIONS,
} from "./dashboard-filters"

describe("matchesRiskFilter", () => {
  it("matches everything when no risk is chosen", () => {
    for (const risk of ["critical", "high", "medium", "low"] as const) {
      expect(matchesRiskFilter(ALL_FILTER, risk, true)).toBe(true)
    }
  })

  it("counts Critical as High when merged", () => {
    expect(matchesRiskFilter("high", "critical", true)).toBe(true)
    expect(matchesRiskFilter("high", "high", true)).toBe(true)
    expect(matchesRiskFilter("high", "medium", true)).toBe(false)
    expect(matchesRiskFilter("high", "low", true)).toBe(false)
  })

  it("leaves Medium and Low as they were", () => {
    expect(matchesRiskFilter("medium", "medium", true)).toBe(true)
    expect(matchesRiskFilter("medium", "critical", true)).toBe(false)
    expect(matchesRiskFilter("low", "low", true)).toBe(true)
  })

  it("keeps the four separate tiers when not merged", () => {
    expect(matchesRiskFilter("high", "critical", false)).toBe(false)
    expect(matchesRiskFilter("critical", "critical", false)).toBe(true)
  })
})

describe("the Plant filter's options", () => {
  const render = (props: object) =>
    renderToStaticMarkup(
      createElement(DashboardFilters, { value: EMPTY_DASHBOARD_FILTERS, onChange: () => {}, ...props }),
    )

  it("shows the Stockout Risk and the other three filters the Overview relies on", () => {
    const markup = render({ mergeCriticalIntoHigh: true })
    for (const label of ["Plant", "Criticality", "Demand Pattern", "Stockout Risk"]) {
      expect(markup).toContain(label)
    }
  })
})

describe("the Recommendations page's filter bar", () => {
  const render = (props: object) =>
    renderToStaticMarkup(
      createElement(DashboardFilters, { value: EMPTY_DASHBOARD_FILTERS, onChange: () => {}, ...props }),
    )

  it("still offers Recommendation Status by default (the Overview uses it)", () => {
    expect(render({})).toContain("Recommendation Status")
  })

  it("drops Recommendation Status when asked", () => {
    expect(render({ showStatusFilter: false })).not.toContain("Recommendation Status")
  })

  it("offers the OAR confidence filter only when asked", () => {
    expect(render({})).not.toContain("Recommendation Confidence")
    expect(render({ showConfidenceFilter: true })).toContain("Recommendation Confidence")
  })

  it("offers two Recommendation choices: OAR and Stock item", () => {
    expect(RECOMMENDATION_TYPE_OPTIONS.map((o) => o.label)).toEqual(["OAR", "Stock item"])
    expect(CONFIDENCE_OPTIONS.map((o) => o.label)).toEqual(["High", "Medium", "Low"])
  })
})

describe("isDashboardFiltersActive with a page's own starting point", () => {
  const onOar = { ...EMPTY_DASHBOARD_FILTERS, type: "oar" }

  it("counts OAR as a filter against the default of every filter off", () => {
    expect(isDashboardFiltersActive(onOar)).toBe(true)
  })

  it("does not count the page's own starting point as a filter, so Clear filters stays off until something changes", () => {
    expect(isDashboardFiltersActive(onOar, onOar)).toBe(false)
    expect(isDashboardFiltersActive({ ...onOar, plant: "1300" }, onOar)).toBe(true)
    expect(isDashboardFiltersActive({ ...onOar, type: "stock_item" }, onOar)).toBe(true)
  })
})
