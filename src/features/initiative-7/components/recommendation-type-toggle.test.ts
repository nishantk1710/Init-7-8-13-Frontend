// The Recommendations page's view toggle: OAR to Min-Max | Min-Max to OAR | Stock item.
//
// It replaces the Recommendation dropdown. Filters come first, then the toggle, then the results; choosing a view
// changes the filters the way the dropdown used to; "Clear filters" keeps the view it is on.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { ALL_FILTER, EMPTY_DASHBOARD_FILTERS, isDashboardFiltersActive } from "@/features/initiative-7/components/dashboard-filters"
import {
  listParamsFromFilters,
  normaliseRecommendationFilters,
  RECOMMENDATIONS_PAGE_FILTERS,
  resetFiltersForView,
} from "@/features/initiative-7/utils/recommendation-list-query"
import { isMinMaxToOarView, RECOMMENDATION_TOGGLE_OPTIONS } from "@/features/initiative-7/utils/reverse-conversion-query"

const SRC = join(__dirname, "..", "..", "..")
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8")
const I7 = "features/initiative-7"

/** What the page does when the toggle is pressed. */
const choose = (current: typeof RECOMMENDATIONS_PAGE_FILTERS, type: string) =>
  normaliseRecommendationFilters({ ...current, type }, current)

describe("choosing a view changes the filters the way the dropdown did", () => {
  it("OAR to Min-Max shows the OAR filters and opens on the Eligible conversions", () => {
    const stock = choose(RECOMMENDATIONS_PAGE_FILTERS, "stock_item")
    const back = choose(stock, "oar")
    expect(back).toMatchObject({ type: "oar", conversion: "ELIGIBLE" })
    expect(listParamsFromFilters(back, 1)).toMatchObject({ type: "oar", conversionEligibility: "ELIGIBLE" })
  })

  it("Stock item drops the OAR-only filters", () => {
    const stock = choose({ ...RECOMMENDATIONS_PAGE_FILTERS, confidence: "HIGH" }, "stock_item")
    expect(stock).toMatchObject({ type: "stock_item", confidence: ALL_FILTER, conversion: ALL_FILTER })
    expect(listParamsFromFilters(stock, 1)).toMatchObject({ type: "stock_item", actionable: true })
  })

  it("Min-Max to OAR is its own view and carries no OAR-only filter", () => {
    const view = choose(RECOMMENDATIONS_PAGE_FILTERS, "min_max_to_oar")
    expect(isMinMaxToOarView(view)).toBe(true)
    expect(view).toMatchObject({ confidence: ALL_FILTER, conversion: ALL_FILTER })
  })

  it("every toggle option leads to a view the page can show", () => {
    for (const option of RECOMMENDATION_TOGGLE_OPTIONS) {
      expect(choose(RECOMMENDATIONS_PAGE_FILTERS, option.value).type).toBe(option.value)
    }
  })
})

describe("Clear filters keeps the view the toggle is on", () => {
  it("OAR to Min-Max clears back to its own opening view", () => {
    expect(resetFiltersForView("oar")).toEqual(RECOMMENDATIONS_PAGE_FILTERS)
  })

  it("Stock item and Min-Max to OAR clear back to their own, never to OAR", () => {
    expect(resetFiltersForView("stock_item")).toEqual({ ...EMPTY_DASHBOARD_FILTERS, type: "stock_item", conversion: ALL_FILTER, recommendation: RECOMMENDATIONS_PAGE_FILTERS.recommendation })
    expect(resetFiltersForView("stock_item").type).toBe("stock_item")
    expect(resetFiltersForView("min_max_to_oar").type).toBe("min_max_to_oar")
    expect(resetFiltersForView("stock_item").conversion).toBe(ALL_FILTER)
  })

  it("the button is idle on each view's own opening state, and live once a filter is set", () => {
    for (const type of ["oar", "stock_item"]) {
      const opened = choose(RECOMMENDATIONS_PAGE_FILTERS, type)
      expect(isDashboardFiltersActive(opened, resetFiltersForView(type)), `${type} untouched`).toBe(false)
      expect(isDashboardFiltersActive({ ...opened, plant: "1500" }, resetFiltersForView(type)), `${type} with a plant`).toBe(true)
    }
  })

  it("pressing it on Stock item leaves the page on Stock item", () => {
    // The bar hands the reset state to the page; the page forces the view the toggle chose.
    const stock = choose(RECOMMENDATIONS_PAGE_FILTERS, "stock_item")
    const afterClear = normaliseRecommendationFilters({ ...resetFiltersForView("stock_item"), type: stock.type }, stock)
    expect(afterClear.type).toBe("stock_item")
  })
})

describe("the toggle looks like the app's other segmented toggles", () => {
  const toggle = read(`${I7}/components/recommendation-type-toggle.tsx`)

  it("is the same bordered, shadowed track with the selected view as a white box outlined in blue", () => {
    expect(toggle).toContain("inline-flex h-11 items-center gap-1 rounded-lg border-2 border-action/40 bg-card p-1 shadow-lg")
    expect(toggle).toContain("border-action bg-background text-foreground shadow-md")
    expect(toggle).toContain("text-foreground/70 hover:text-foreground")
  })

  it("is a set of tabs a keyboard and a screen reader can use, one selected at a time", () => {
    expect(toggle).toContain('role="tablist"')
    expect(toggle).toContain('role="tab"')
    expect(toggle).toContain("aria-selected={selected}")
    expect(toggle).toContain('aria-label="Recommendation type"')
    expect(toggle).toContain('type="button"')
  })

  it("does nothing when the view that is already selected is pressed", () => {
    expect(toggle).toContain("!selected && onChange(option.value)")
  })

  it("does not borrow code from another initiative", () => {
    expect(toggle).not.toMatch(/initiative-13|initiative-8/)
  })
})

describe("the page order is filters, then the toggle, then the results", () => {
  const workspace = read(`${I7}/components/recommendations-workspace.tsx`)
  const minMax = read(`${I7}/components/min-max-to-oar-workspace.tsx`)

  it("the OAR to Min-Max and Stock item view draws the toggle under its filter bar and above its results", () => {
    const filters = workspace.indexOf("<DashboardFilters")
    const toggle = workspace.indexOf("{viewToggle}")
    const results = workspace.indexOf("<RecommendationReviewTable")
    expect(filters).toBeGreaterThan(-1)
    expect(toggle).toBeGreaterThan(filters)
    expect(results).toBeGreaterThan(toggle)
  })

  it("the Min-Max to OAR view draws the toggle under its filter bar and above its table", () => {
    const filters = minMax.indexOf("Export CSV")
    const toggle = minMax.indexOf("{viewToggle}")
    const table = minMax.indexOf("<MinMaxToOarTable")
    expect(toggle).toBeGreaterThan(filters)
    expect(table).toBeGreaterThan(toggle)
  })

  it("the Min-Max to OAR view has no 'How these were generated' panel, and its reconciliation line sits below the table", () => {
    expect(minMax).not.toContain("HowGeneratedPanel")
    expect(minMax.indexOf("<ReconciliationLine")).toBeGreaterThan(minMax.indexOf("<MinMaxToOarTable"))
    expect(minMax.indexOf("<ReconciliationLine")).toBeGreaterThan(minMax.indexOf("<TablePagination"))
  })

  it("the page hands the one toggle to whichever view is showing, and draws none of its own above the bars", () => {
    expect(workspace.match(/<RecommendationTypeToggle/g)).toHaveLength(1)
    // (a link can also say where the view opens -- `initialFilters` -- but the toggle is always the page's one.)
    expect(workspace).toContain("<MinMaxToOarWorkspace viewToggle={viewToggle} initialFilters={reverseStart} />")
    expect(workspace).toContain("<LiveRecommendationsWorkspace filters={filters} setFilters={setFilters} viewToggle={viewToggle} />")
  })

  it("the Recommendation dropdown is gone from both filter bars", () => {
    expect(workspace).not.toMatch(/showTypeFilter|typeFilterLabel|extraTypeOptions/)
    expect(minMax).not.toContain('label="Recommendation"')
  })

  it("Clear filters keeps the view, and the bar never changes it", () => {
    expect(workspace).toContain("const resetFilters = resetFiltersForView(filters.type)")
    expect(workspace).toContain("normaliseRecommendationFilters({ ...next, type: filters.type }, filters)")
  })
})
