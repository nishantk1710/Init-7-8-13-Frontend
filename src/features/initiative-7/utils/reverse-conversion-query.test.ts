// What the Min-Max to OAR view asks the backend for, and the words it shows about how the numbers were made.

import { describe, expect, it } from "vitest"

import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"
import {
  activeReverseFilterCount,
  describeAnchor,
  describePolicy,
  formatFigure,
  formatLoadedAt,
  formatMonthsAgo,
  formatYearMonth,
  isMinMaxToOarView,
  RECOMMENDATION_TOGGLE_OPTIONS,
  REVERSE_DEFAULT_FILTERS,
  REVERSE_PAGE_SIZE,
  reverseCategoryLabel,
  reverseConfidenceLabel,
  reverseErrorMessage,
  reverseExportParams,
  reverseFilterKey,
  reverseParamsFromFilters,
  type ReverseFilterState,
} from "@/features/initiative-7/utils/reverse-conversion-query"
import { MIN_MAX_TO_OAR_TYPE, REVERSE_CATEGORIES, type ApiReverseAnchor } from "@/features/initiative-7/types/reverse-conversion"

const f = (overrides: Partial<ReverseFilterState> = {}): ReverseFilterState => ({ ...REVERSE_DEFAULT_FILTERS, ...overrides })

/** What the backend's ReverseConversionPolicy.parameters() returns today. */
const POLICY_PARAMETERS = {
  policy_version: "reverse-conversion-v1",
  mrp_types: ["VM", "VB"],
  plants: ["1300", "1500"],
  protected_criticality_tiers: ["CRITICAL", "IMPACT", "INSURANCE"],
  obsolete_criticality_tier: "OBSOLETE",
  window_months: 12,
  zero_use_window_months: 24,
  minimum_history_span_months: 12,
  maximum_lead_time_days: 90,
  recommended_max_issues: 2,
  recommended_max_months: 2,
  maximum_months_since_last_movement: 9,
  frequent_issues_above: 4,
  frequent_months_above: 4,
  new_material_age_months: 24,
  new_material_minimum_lifetime_months: 3,
}

describe("the Recommendations page's view toggle", () => {
  it("offers OAR to Stock item, Stock item to OAR and Stock item, in that order", () => {
    expect(RECOMMENDATION_TOGGLE_OPTIONS).toEqual([
      { value: "oar", label: "OAR to Stock item" },
      { value: "min_max_to_oar", label: "Stock item to OAR" },
      { value: "stock_item", label: "Stock item" },
    ])
  })

  it("keeps the values the page has always used for OAR and Stock item, and adds the new view's", () => {
    expect(RECOMMENDATION_TOGGLE_OPTIONS.map((o) => o.value)).toEqual(["oar", MIN_MAX_TO_OAR_TYPE, "stock_item"])
    expect(MIN_MAX_TO_OAR_TYPE).toBe("min_max_to_oar")
  })

  it("is recognised only for its own value", () => {
    expect(isMinMaxToOarView({ type: "min_max_to_oar" })).toBe(true)
    for (const type of ["oar", "stock_item", "all", "", "declining", "normal"]) expect(isMinMaxToOarView({ type })).toBe(false)
  })
})

describe("the list request", () => {
  it("opens on the Eligible materials, with every other filter off", () => {
    expect(REVERSE_DEFAULT_FILTERS).toEqual({
      category: ALL_FILTER,
      eligibility: "eligible",
      plant: ALL_FILTER,
      reason: ALL_FILTER,
      confidence: ALL_FILTER,
      criticality: ALL_FILTER,
      leadTime: ALL_FILTER,
      material: "",
    })
    expect(reverseParamsFromFilters(REVERSE_DEFAULT_FILTERS, 1)).toEqual({
      category: undefined,
      eligibility: "eligible",
      plant: undefined,
      reason: undefined,
      criticality: undefined,
      leadTimeBucket: undefined,
      search: undefined,
      page: 1,
      pageSize: REVERSE_PAGE_SIZE,
    })
  })

  it("pages 25 rows at a time", () => {
    expect(REVERSE_PAGE_SIZE).toBe(25)
    expect(reverseParamsFromFilters(f(), 3)).toMatchObject({ page: 3, pageSize: 25 })
  })

  it("sends every chosen filter under the backend's parameter names", () => {
    const params = reverseParamsFromFilters(
      f({ category: "recommended_for_oar", eligibility: "not_eligible", plant: "1500", reason: "lead_time", confidence: "low", criticality: "unknown", leadTime: ">90d", material: "  1000123  " }),
      2,
    )
    expect(params).toEqual({
      category: "recommended_for_oar",
      eligibility: "not_eligible",
      plant: "1500",
      reason: "lead_time",
      confidence: "low",
      criticality: "unknown",
      leadTimeBucket: ">90d",
      search: "1000123",
      page: 2,
      pageSize: 25,
    })
  })

  it("sends no category at all when the category is All", () => {
    expect(reverseParamsFromFilters(f({ category: ALL_FILTER }), 1).category).toBeUndefined()
  })

  it("leaves out a blank or whitespace-only search", () => {
    expect(reverseParamsFromFilters(f({ material: "   " }), 1).search).toBeUndefined()
  })
})

describe("Export Excel", () => {
  it("asks for exactly what the table shows, with no paging", () => {
    const filters = f({ category: "obsolescence_review", plant: "1300", material: "hose" })
    const exported = reverseExportParams(filters)
    expect(exported).toEqual({ category: "obsolescence_review", eligibility: "eligible", plant: "1300", search: "hose", reason: undefined, confidence: undefined, criticality: undefined, leadTimeBucket: undefined })
    expect(exported).not.toHaveProperty("page")
    expect(exported).not.toHaveProperty("pageSize")
    const { page, pageSize, ...table } = reverseParamsFromFilters(filters, 1)
    expect([page, pageSize]).toEqual([1, 25])
    expect(exported).toEqual(table) // the file and the screen cannot disagree
  })

  it("follows the opening view too", () => {
    expect(reverseExportParams(REVERSE_DEFAULT_FILTERS).eligibility).toBe("eligible")
  })
})

describe("filter key and active count", () => {
  it("changes with every filter that decides the rows, so the page goes back to 1", () => {
    const base = reverseFilterKey(f())
    for (const change of [
      { category: "not_eligible" },
      { eligibility: "not_eligible" },
      { confidence: "high" },
      { plant: "1300" },
      { reason: "lapsed" },
      { criticality: "NORMAL" },
      { leadTime: "0-30d" },
      { material: "abc" },
    ])
      expect(reverseFilterKey(f(change))).not.toBe(base)
  })

  it("ignores whitespace around the search", () => {
    expect(reverseFilterKey(f({ material: " abc " }))).toBe(reverseFilterKey(f({ material: "abc" })))
  })

  it("counts the filters that differ from the opening view", () => {
    expect(activeReverseFilterCount(REVERSE_DEFAULT_FILTERS)).toBe(0)
    expect(activeReverseFilterCount(f({ material: "   " }))).toBe(0)
    expect(activeReverseFilterCount(f({ eligibility: ALL_FILTER }))).toBe(1)
    expect(activeReverseFilterCount(f({ eligibility: "not_eligible", plant: "1500", material: "x" }))).toBe(3)
  })
})

describe("category labels", () => {
  it("names the categories as this screen shows them (the first reads Convert to OAR)", () => {
    expect(REVERSE_CATEGORIES.map((c) => c.label)).toEqual(["Convert to OAR", "Not Eligible"])
    expect(reverseCategoryLabel("recommended_for_oar")).toBe("Convert to OAR")
    expect(reverseCategoryLabel("manual_review")).toBe("manual_review") // retired: never a category any more
    expect(reverseConfidenceLabel("medium")).toBe("Medium")
    expect(reverseConfidenceLabel(null)).toBe("—")
    expect(reverseCategoryLabel("something_else")).toBe("something_else")
  })
})

describe("formatting", () => {
  it("writes a year-month as a month name and year", () => {
    expect(formatYearMonth("2026-08")).toBe("Aug 2026")
    expect(formatYearMonth("2015-01")).toBe("Jan 2015")
    expect(formatYearMonth("2026-12")).toBe("Dec 2026")
    expect(formatYearMonth(null)).toBe("—")
    expect(formatYearMonth(undefined)).toBe("—")
    expect(formatYearMonth("garbage")).toBe("garbage")
  })

  it("says how long ago the latest movement was", () => {
    expect(formatMonthsAgo(0)).toBe("in anchor month")
    expect(formatMonthsAgo(1)).toBe("1 month ago")
    expect(formatMonthsAgo(9)).toBe("9 months ago")
    expect(formatMonthsAgo(null)).toBe("—")
  })

  it("formats a figure with thousands separators and never invents a value or a currency", () => {
    expect(formatFigure(1234567.891, 0)).toBe("1,234,568")
    expect(formatFigure(12.5)).toBe("12.5")
    expect(formatFigure(0)).toBe("0")
    expect(formatFigure(null)).toBe("—")
    expect(formatFigure(5000, 0)).not.toMatch(/[R$€£]/)
  })

  it("gives the load date, or says there is none", () => {
    expect(formatLoadedAt("2026-11-23T09:30:00+00:00")).toBe("2026-11-23")
    expect(formatLoadedAt(null)).toBe("not available")
  })
})

describe("how the numbers were produced", () => {
  const anchor = (overrides: Partial<ApiReverseAnchor> = {}): ApiReverseAnchor => ({
    month: "2026-10",
    source: "configured",
    latest_staged_month: "2026-11",
    data_loaded_at: null,
    warnings: [],
    ...overrides,
  })

  it("states the anchor month and that later months are ignored", () => {
    const text = describeAnchor(anchor())
    expect(text).toContain("Oct 2026")
    expect(text).toContain("latest complete month")
    expect(text).toContain("Months after it are ignored")
  })

  it("says whether the anchor was set or worked out from the load time", () => {
    expect(describeAnchor(anchor({ source: "configured" }))).toContain("set explicitly")
    expect(describeAnchor(anchor({ source: "data_load_timestamp" }))).toContain("worked out from when the data was loaded")
  })

  it("describes every applied threshold from the policy it was given", () => {
    const text = describePolicy(POLICY_PARAMETERS).join("\n")
    expect(text).toContain("VM, VB")
    expect(text).toContain("1300, 1500")
    expect(text).toContain("latest 12 complete months")
    expect(text).toContain("Convert to OAR, High confidence: at most 2 issues and 2 months with consumption, last movement within 9 months")
    expect(text).toContain("Convert to OAR, Medium confidence")
    expect(text).toContain("Convert to OAR, Low confidence")
    expect(text).not.toContain("Manual Review")
    expect(text).toContain("at least 12 months between first and latest consumption")
    expect(text).toContain("first movement within 24 months")
    expect(text).toContain("at least 3 months with consumption")
    expect(text).toContain("more than 4 issues or more than 4 months")
    expect(text).toContain("CRITICAL, IMPACT, INSURANCE")
    expect(text).toContain("over 90 days")
    expect(text).toContain("no issues in 24 months")
    expect(text).toContain("OBSOLETE")
  })

  it("is built from the response, not from numbers written into the page", () => {
    const changed = describePolicy({ ...POLICY_PARAMETERS, recommended_max_issues: 3, frequent_issues_above: 6, maximum_lead_time_days: 120 }).join("\n")
    expect(changed).toContain("at most 3 issues")
    expect(changed).toContain("more than 6 issues")
    expect(changed).toContain("over 120 days")
    expect(changed).not.toContain("at most 2 issues")
    expect(changed).not.toContain("over 90 days")
  })

  it("leaves out a threshold the response does not carry rather than guessing it", () => {
    const text = describePolicy({}).join("\n")
    expect(text).not.toMatch(/High confidence:/)
    expect(text).not.toMatch(/\d/) // no number appears from nowhere
  })

  it("always says what the stock value does and does not do", () => {
    const text = describePolicy(POLICY_PARAMETERS).join("\n")
    expect(text).toContain("only ranks materials inside a category")
    expect(text).toContain("zero stock and a missing price never remove a material")
    expect(text).toContain("no currency")
    expect(text).toContain("Nothing is written to SAP")
  })
})

describe("errors", () => {
  it("explains an unavailable anchor in words an operator can act on", () => {
    const text = reverseErrorMessage({ code: "REVERSE_ANCHOR_UNAVAILABLE", message: "No reliable data-load timestamp." })
    expect(text).toContain("I7_REVERSE_ANCHOR_MONTH")
    expect(text).toContain("No reliable data-load timestamp.")
  })

  it("leaves any other error's message alone", () => {
    expect(reverseErrorMessage({ code: "REVERSE_PLANT_INVALID", message: "Plant must be one of 1300, 1500." })).toBe("Plant must be one of 1300, 1500.")
    expect(reverseErrorMessage({ message: "Network down" })).toBe("Network down")
  })
})
