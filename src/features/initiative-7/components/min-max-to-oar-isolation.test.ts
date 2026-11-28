// Min-Max to OAR must not change OAR, Stock item, the Overview or the quarterly report.
//
// Part behavioural (the shared pure functions answer exactly as before for the existing values), part a read of
// the source tree (which files may mention the new feature, and which modules the new files may import), because
// a component cannot be rendered in this suite's node environment and the guarantee has to be checked somewhere.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  ALL_FILTER,
  EMPTY_DASHBOARD_FILTERS,
  RECOMMENDATION_TYPE_OPTIONS,
} from "@/features/initiative-7/components/dashboard-filters"
import {
  listParamsFromFilters,
  normaliseRecommendationFilters,
  RECOMMENDATIONS_PAGE_FILTERS,
} from "@/features/initiative-7/utils/recommendation-list-query"
import { isMinMaxToOarView } from "@/features/initiative-7/utils/reverse-conversion-query"

const SRC = join(__dirname, "..", "..", "..")
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8")
const I7 = "features/initiative-7"

describe("the shared option list", () => {
  it("is still exactly OAR and Stock item, so no other page can offer Min-Max to OAR", () => {
    expect(RECOMMENDATION_TYPE_OPTIONS).toEqual([
      { value: "oar", label: "OAR" },
      { value: "stock_item", label: "Stock item" },
    ])
  })

  it("the shared filter bar knows nothing of the new feature (it is not edited at all)", () => {
    const source = read(`${I7}/components/dashboard-filters.tsx`)
    expect(source).not.toMatch(/reverse-conversion|MIN_MAX_TO_OAR|min_max_to_oar|MinMaxToOar|extraTypeOptions|RecommendationTypeToggle/)
  })
})

describe("the Recommendation dropdown's existing behaviour", () => {
  it("keeps OAR exactly as it was, and Eligible as the page's opening view", () => {
    expect(RECOMMENDATIONS_PAGE_FILTERS).toEqual({ ...EMPTY_DASHBOARD_FILTERS, type: "oar", conversion: "ELIGIBLE" })
    const same = normaliseRecommendationFilters(RECOMMENDATIONS_PAGE_FILTERS)
    expect(same).toBe(RECOMMENDATIONS_PAGE_FILTERS) // untouched, the very same object
  })

  it("still drops the OAR-only filters when leaving OAR for Stock item", () => {
    const next = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item", confidence: "HIGH" }, RECOMMENDATIONS_PAGE_FILTERS)
    expect(next).toMatchObject({ type: "stock_item", confidence: ALL_FILTER, conversion: ALL_FILTER })
  })

  it("still starts on Eligible when coming back to OAR from Stock item", () => {
    const stock = { ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item", conversion: ALL_FILTER }
    const next = normaliseRecommendationFilters({ ...stock, type: "oar" }, stock)
    expect(next).toMatchObject({ type: "oar", conversion: "ELIGIBLE" })
  })

  it("still turns any other type back into OAR", () => {
    for (const type of ["all", "", "declining", "bogus"]) {
      expect(normaliseRecommendationFilters({ ...EMPTY_DASHBOARD_FILTERS, type }).type).toBe("oar")
    }
  })

  it("still builds exactly the OAR and Stock item list requests", () => {
    expect(listParamsFromFilters(RECOMMENDATIONS_PAGE_FILTERS, 1)).toEqual({
      page: 1,
      pageSize: 25,
      sort: "generated_at",
      sortDesc: true,
      valueChange: undefined,
      status: "READY_FOR_REVIEW",
      plant: undefined,
      type: "oar",
      confidence: undefined,
      conversionEligibility: "ELIGIBLE",
      actionable: undefined,
      search: undefined,
      criticalityLevel: undefined,
      demandClass: undefined,
      statusGroup: undefined,
      risk: undefined,
    })
    expect(listParamsFromFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item", conversion: ALL_FILTER }, 1)).toMatchObject({
      type: "stock_item",
      sort: "value_change",
      actionable: true,
      conversionEligibility: undefined,
    })
  })

  it("is not on Min-Max to OAR for either existing value", () => {
    expect(isMinMaxToOarView(RECOMMENDATIONS_PAGE_FILTERS)).toBe(false)
    expect(isMinMaxToOarView({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "stock_item" })).toBe(false)
  })
})

describe("the new option on the dropdown", () => {
  it("lets Min-Max to OAR through the filter normaliser instead of snapping back to OAR", () => {
    const next = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "min_max_to_oar" }, RECOMMENDATIONS_PAGE_FILTERS)
    expect(next.type).toBe("min_max_to_oar")
    expect(next).toMatchObject({ confidence: ALL_FILTER, conversion: ALL_FILTER }) // the OAR-only filters do not carry over
    expect(isMinMaxToOarView(next)).toBe(true)
  })

  it("returns to OAR on Eligible, as from Stock item", () => {
    const minMax = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "min_max_to_oar" }, RECOMMENDATIONS_PAGE_FILTERS)
    const back = normaliseRecommendationFilters({ ...minMax, type: "oar" }, minMax)
    expect(back).toMatchObject({ type: "oar", conversion: "ELIGIBLE" })
  })

  it("returns to Stock item with no OAR-only filter", () => {
    const minMax = normaliseRecommendationFilters({ ...RECOMMENDATIONS_PAGE_FILTERS, type: "min_max_to_oar" }, RECOMMENDATIONS_PAGE_FILTERS)
    expect(normaliseRecommendationFilters({ ...minMax, type: "stock_item" }, minMax)).toMatchObject({
      type: "stock_item",
      confidence: ALL_FILTER,
      conversion: ALL_FILTER,
    })
  })
})

describe("which pages know about the new feature", () => {
  const mentions = (source: string) => /min_max_to_oar|MinMaxToOar|MIN_MAX_TO_OAR|extraTypeOptions|reverse-conversion/.test(source)

  it("not the Overview", () => {
    expect(mentions(read(`${I7}/components/live-overview-workspace.tsx`))).toBe(false)
  })

  it("not the quarterly report", () => {
    expect(mentions(read(`${I7}/components/quarterly-management-view.tsx`))).toBe(false)
  })

  it("not the OAR / Stock item table, its detail panel or its data hook", () => {
    for (const file of ["components/recommendation-review-table.tsx", "components/recommendation-review-panel.tsx", "hooks/use-live-recommendations.ts", "services/i7-api.ts"]) {
      expect(mentions(read(`${I7}/${file}`)), file).toBe(false)
    }
  })

  it("the Recommendations workspace switches view with the toggle, and its filter bar no longer carries the dropdown", () => {
    const source = read(`${I7}/components/recommendations-workspace.tsx`)
    expect(source).toContain("<RecommendationTypeToggle")
    expect(source).toContain("options={RECOMMENDATION_TOGGLE_OPTIONS}")
    expect(source).not.toMatch(/showTypeFilter|typeFilterLabel|extraTypeOptions/)
    expect(source.match(/<RecommendationTypeToggle/g)).toHaveLength(1)
    expect(source).toContain("isMinMaxToOarView(filters)")
    expect(source).toContain("<MinMaxToOarWorkspace")
    expect(source).toContain("<LiveRecommendationsWorkspace")
  })

  it("the workspace mounts one view or the other, never both", () => {
    const source = read(`${I7}/components/recommendations-workspace.tsx`)
    const branch = source.slice(source.indexOf("isMinMaxToOarView(filters) ?"))
    expect(branch.indexOf("<MinMaxToOarWorkspace")).toBeGreaterThan(-1)
    expect(branch.indexOf(") : (")).toBeGreaterThan(branch.indexOf("<MinMaxToOarWorkspace"))
    expect(branch.indexOf("<LiveRecommendationsWorkspace")).toBeGreaterThan(branch.indexOf(") : ("))
  })
})

describe("one name for each category on screen", () => {
  it("the line under the cards uses the screen's own category labels, not the API's", () => {
    const panels = read(`${I7}/components/min-max-to-oar-panels.tsx`)
    const table = read(`${I7}/components/min-max-to-oar-table.tsx`)
    expect(panels).toContain("reverseCategoryLabel(totals.category)")
    // The API's own wording ("Recommended for OAR") is never put on screen directly, and no Category column is drawn.
    expect(panels).not.toMatch(/\{totals\.label\}/)
    expect(table).not.toMatch(/\{row\.category_label\}/)
    expect(table).not.toContain("<TableHead>Category</TableHead>")
  })
})

describe("the new files stay apart from the OAR / Stock item feature", () => {
  const NEW_FILES = [
    "components/min-max-to-oar-workspace.tsx",
    "components/min-max-to-oar-table.tsx",
    "components/min-max-to-oar-panels.tsx",
    "components/min-max-to-oar-info.tsx",
    "components/min-max-to-oar-detail.tsx",
    "components/min-max-to-oar-chart.tsx",
    "hooks/use-reverse-consumption.ts",
    "hooks/use-reverse-request.ts",
    "components/min-max-to-oar-convert.tsx",
    "services/reverse-conversion-requests-api.ts",
    "utils/reverse-request-state.ts",
    "components/recommendation-type-toggle.tsx",
    "hooks/use-reverse-recommendations.ts",
    "services/reverse-conversion-api.ts",
    "types/reverse-conversion.ts",
    "utils/reverse-conversion-query.ts",
    "utils/reverse-conversion-info.ts",
  ]
  const FORBIDDEN = [
    "use-live-recommendations",
    "use-live-recommendation-summary",
    "recommendation-review-table",
    "recommendation-review-panel",
    "recommendation-list-query",
    "services/i7-api",
    "min-max-conversion-dialog",
    "live-decision-panel",
  ]

  it.each(NEW_FILES)("%s imports nothing from the OAR / Stock item list, panel or API", (file) => {
    const imports = read(`${I7}/${file}`)
      .split("\n")
      .filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line) || /^\s*\}\s*from\s/.test(line))
      .join("\n")
    for (const forbidden of FORBIDDEN) expect(imports, `${file} imports ${forbidden}`).not.toContain(forbidden)
  })

  it("the only write calls are the conversion requests, in their own service", () => {
    const writes = read(`${I7}/services/reverse-conversion-requests-api.ts`)
    expect(writes.match(/apiPost</g)).toHaveLength(3) // raise a request, decline one, apply an approval action
    expect(writes).not.toMatch(/apiPostForm|method:\s*"(PUT|PATCH|DELETE)"/)
  })

  it("the list, export and consumption service only ever reads (no write call)", () => {
    const source = read(`${I7}/services/reverse-conversion-api.ts`)
    expect(source).not.toMatch(/apiPost|apiPostForm|method:\s*"(POST|PUT|PATCH|DELETE)"/)
  })
})
