// The management view of a generated quarterly report: what it draws from the saved report, what it will not
// draw, and that an old saved report is offered for regeneration instead of passed off as this period's picture.
//
// Rendered to static markup with react-dom/server, as the other report tests do: this project's vitest runs without
// a DOM, so effects (the list of recommendations at the bottom) do not run.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  QuarterlyManagementView,
  dayAfter,
  stockChange,
  stockFigure,
} from "@/features/initiative-7/components/quarterly-management-view"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const workspace = read("src/features/initiative-7/components/quarterly-reports-workspace.tsx")
const viewSource = read("src/features/initiative-7/components/quarterly-management-view.tsx")

const MONTHS = [
  { month: "2026-10-01", label: "Oct 2026", state: "ended" as const, has_consumption_data: true, usable: true },
  { month: "2026-11-01", label: "Nov 2026", state: "ended" as const, has_consumption_data: false, usable: false },
  { month: "2026-12-01", label: "Dec 2026", state: "ended" as const, has_consumption_data: false, usable: false },
]

function card(key: string, overrides: Partial<ApiKpiCard> = {}): ApiKpiCard {
  return {
    key, title: `Title ${key}`, unit: "units", value: "10", status: "AVAILABLE", explanation: `Explains ${key}.`, kind: "EVENT",
    measured_on: null, period_label: "Oct 2026 – Dec 2026", denominator: null, denominator_label: null, basis: "current_calculation",
    unavailable_reason: null, note: null, ...overrides,
  }
}

function management(overrides: Partial<ApiQuarterManagement> = {}, staleStockout = false): ApiQuarterManagement {
  const stockout = staleStockout
    ? { at_risk: 891, evaluated: 9916, insufficient_data: 503, as_of: "2026-05-31", stale: true, stale_note: "Stockout risk was last measured on 31 May 2026, 214 days before this report's cutoff." }
    : { at_risk: 891, evaluated: 9916, insufficient_data: 503, as_of: "2026-12-31", stale: false, stale_note: null }
  const figures = (population: number, atRisk: number, excess: number) => ({
    population, stockout: { ...stockout, at_risk: atRisk }, excess_count: excess, excess_opportunity: "1000.00",
    net_rop_value_impact: "-500.00", priced_count: population, currency: null,
  })
  return {
    period: { status: "COMPLETE", cutoff: "2026-12-31", months: MONTHS, note: "Oct 2026 – Dec 2026 is complete." },
    monthly_activity: {
      months: MONTHS,
      rows: [
        { key: "recommendations_generated", label: "Recommendations generated", unit: "recommendation records", kind: "EVENT", months: [18627, 0, 0], quarter_total: 18627, status: "AVAILABLE", reconciles: true, note: "Records, not distinct materials." },
        { key: "sap_adoptions_confirmed", label: "Confirmed SAP adoptions", unit: "adoptions", kind: "EVENT", months: [null, null, null], quarter_total: null, status: "UNKNOWN", reconciles: null, note: "Not measured by month." },
      ],
    },
    kpis: [card("pending_approval", { kind: "STATUS_AS_OF", period_label: "as of 15 Jan 2027" }), card("materials_assessed", { value: "18627", denominator: 18700, denominator_label: "material-plants with a recommendation" })],
    position: figures(18627, 891, 727),
    plant_positions: [
      { plant: null, figures: figures(18627, 891, 727) },
      { plant: "1300", figures: figures(10881, 432, 347) },
      { plant: "1500", figures: figures(7746, 459, 380) },
    ],
    status_distribution: { kind: "STATUS_AS_OF", basis: "Current status", measured_on: "2027-01-15", total: 18627, rows: [{ status: "READY_FOR_REVIEW", count: 18627, percentage: "100.00" }] },
    forecast_actual: { status: "NOT_AVAILABLE", months: [], forecast_total: null, actual_total: null, accuracy: null, forecast_run_id: null, note: "n" },
    adoption: { status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 3, reason: "Not measured: no SAP change evidence.", tracked: 3911, adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 3911 },
    data_coverage: {
      latest_consumption_date: "2026-05-30", latest_consumption_month: "2026-05-01", latest_stock_loaded_at: "2026-10-20T10:00:00Z",
      stockout_usage_as_of: "2026-05-31",
      months: MONTHS.map((m) => ({ month: m.month, label: m.label, consumption_status: m.usable ? ("AVAILABLE" as const) : ("NOT_COVERED" as const), recommendations_generated: m.usable ? 18627 : 0 })),
      eligible_recommendations: 18627, eligible_material_plants: 18600, basis: "current_calculation",
      warnings: ["Staged SAP consumption ends in May 2026, so Oct 2026 have no consumption data."],
    },
    definitions: ["Event in the period: something that happened during it."],
    ...overrides,
  }
}

function report(m: ApiQuarterManagement): ApiQuarterlyReport {
  return {
    metadata: { quarter: "Q4 2026", period_start: "2026-10-01", period_end: "2026-12-31", generated_at: "2027-01-15T00:00:00Z", report_version: "1.2" },
    baseline_comparison: {
      baseline_lead_time_source: "MARC-PLIFZ", i07_lead_time_source: null,
      rows: [
        { metric: "ROP", baseline_value: "10", recommendation_value: "20", delta: "10", delta_percentage: "100", both_available_count: 3911, baseline_missing_count: 0, recommendation_missing_count: 0 },
      ],
    },
    source_activity: null,
    management: m,
  } as unknown as ApiQuarterlyReport
}

const render = (m: ApiQuarterManagement) => renderToStaticMarkup(createElement(QuarterlyManagementView, { report: report(m), management: m }))

describe("the cards", () => {
  it("each carry what it is, when it was measured and what it is out of", () => {
    const html = render(management())
    expect(html).toContain("Title materials_assessed")
    expect(html).toContain("Materials we made a recommendation for") // the one plain line
    expect(html).toContain("18,627")
    expect(html).toContain("of 18,700 material-plants with a recommendation")
    expect(html).toContain("as of 15 Jan 2027")
  })

  it("have no (i) and no long explanation on the card, only the figure and one plain line", () => {
    const html = render(management())
    expect(html).not.toContain("is calculated") // the (i) button's label
    expect(html).not.toContain("Explains materials_assessed.")
    expect(html).not.toContain("Status on a date") // the old jargon badge
    expect(html).toContain("before:bg-primary") // still the Overview's card: the accent bar down its edge
  })

  it("show the stockout card as High Stockout Risk, even from a report saved under the old title", () => {
    const m = management({ kpis: [card("critical_stockout_risk", { title: "Critical stockout risk" })] })
    const html = render(m)
    expect(html).toContain("High Stockout Risk")
    expect(html).not.toContain("Critical stockout risk")
  })

  it("say, on the card, when a measurement is worked out from current data rather than a month-end snapshot", () => {
    const current = render(management({ kpis: [card("excess_inventory_opportunity", { kind: "MEASUREMENT", basis: "current_calculation" })] }))
    expect(current).toContain("Current figures, no month-end snapshot")
    const saved = render(management({ kpis: [card("excess_inventory_opportunity", { kind: "MEASUREMENT", basis: "snapshot" })] }))
    expect(saved).not.toContain("Current figures, no month-end snapshot")
    expect(saved).toContain("Saved month-end snapshot")
  })

  it("say Not available and why, never 0, when a figure has no value", () => {
    const m = management({ kpis: [card("critical_stockout_risk", { value: null, status: "NOT_AVAILABLE", unavailable_reason: "Last measured on 31 May 2026." })] })
    const html = render(m)
    expect(html).toContain("Not available")
    expect(html).toContain("Last measured on 31 May 2026.")
  })
})

describe("the Reports page", () => {
  const read2 = (file: string) => readFileSync(join(process.cwd(), file), "utf8")

  it("is called Reports in the sidebar, the page header and the browser tab", () => {
    expect(read2("src/features/initiative-7/manifest.ts")).toContain('label: "Reports"')
    expect(read2("src/features/initiative-7/manifest.ts")).not.toContain('label: "Quarterly Reports"')
    expect(read2("src/features/initiative-7/pages/reports-page.tsx")).toContain('title="Reports"')
    expect(read2("src/app/(live)/inventory-planning/reports/page.tsx")).toContain('title: "Reports — Inventory Planning — Spares AI"')
  })

  it("has a Monthly | Quarterly toggle in the Action Center's blue bordered style, above the list", () => {
    expect(workspace).toContain("REPORT_KINDS.map")
    expect(workspace).toContain("border-2 border-action/40 bg-card p-1 shadow-lg") // the same track as the Action Center's tabs
    expect(workspace).toContain("landingReports(kind,") // the list follows the toggle
  })

  it("generates the latest closed month under the Monthly toggle and the latest closed quarter under the other", () => {
    expect(workspace).toContain('generateQuarterlyReport(undefined, kind === "monthly" ? "month" : undefined)')
    expect(workspace).toContain("Generate latest closed ${noun}")
  })

  it("returns from a report to the list it came from", () => {
    expect(workspace).toContain("setKind(reportKindOf(quarter))") // opening a report sets the toggle to its kind
    expect(workspace).toContain("← All reports")
    expect(workspace).not.toContain("← All quarters")
  })
})

describe("a monthly report", () => {
  const monthly = (m: ApiQuarterManagement) => {
    const base = report(m) as unknown as { metadata: Record<string, unknown> }
    return { ...base, metadata: { ...base.metadata, quarter: "Oct 2026", period_start: "2026-10-01", period_end: "2026-10-31" } }
  }
  const renderMonthly = (m: ApiQuarterManagement) =>
    renderToStaticMarkup(createElement(QuarterlyManagementView, { report: monthly(m) as unknown as ApiQuarterlyReport, management: m }))
  const trends = {
    months: [{ month: "2026-10-01", label: "Oct 2026", state: "FINAL" as const, measured_on: "2026-11-02", month_end_valid: true, stockout_valid: true,
      population: 1, stockout_at_risk: 5, stockout_evaluated: 50, stockout_insufficient: 0, excess_count: 1, excess_opportunity: "100.00",
      net_rop_value_impact: "-50.00", net_rop_change_from_previous: null, currency: null, revision: 1, calc_version: "1", note: null }],
    quarter_end: { status: "NOT_AVAILABLE" as const, month: "2026-10-01", label: "Oct 2026", snapshot_state: "MISSING", measured_on: null,
      reason: "No snapshot was captured for Oct 2026.", population: null, stock_levels: [], latest_available_month: null,
      latest_available_label: null, latest_available_measured_on: null },
    notes: [],
  }

  it("calls its closing position Month-end, and the total column Month total", () => {
    const html = renderMonthly(management({ trends }))
    expect(html).toContain("Month-end position")
    expect(html).not.toContain("Quarter-end position")
    expect(html).toContain("Month total")
    expect(html).not.toContain("Quarter total")
  })

  it("draws no monthly trend charts -- one month is one point per chart", () => {
    const html = renderMonthly(management({ trends }))
    for (const subtitle of ["Materials at risk each month", "Stock above the recommended maximum", "Cash freed (+) or tied up (−)"]) {
      expect(html).not.toContain(subtitle)
    }
    expect(render(management({ trends }))).toContain("Materials at risk each month") // a quarterly report still does
  })

  it("never shows an earlier month as its month-end, in its own words", () => {
    const html = renderMonthly(management({ trends: { ...trends, quarter_end: { ...trends.quarter_end, latest_available_month: "2026-09-01",
      latest_available_label: "Sep 2026", latest_available_measured_on: "2026-10-02" } } }))
    expect(html).toContain("not shown as the month-end")
  })
})

describe("the report's controls", () => {
  it("offer the saved report's Excel workbook beside the PDF, from the backend's export route", () => {
    expect(workspace).toContain("Download Excel")
    expect(workspace).toContain("Download PDF")
    expect(workspace).toContain("fetchQuarterlyReportExportBlob(selectedQuarter)")
  })

  it("draw both download buttons in the blue filter-button style used across the app", () => {
    const pattern = "border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
    for (const handler of ["handleDownloadExcel", "handleDownloadPdf"]) {
      const button = new RegExp(`<Button[^>]*?className="[^"]*${pattern.replace(/[/]/g, "\\/")}[^"]*"\\s+onClick=\\{${handler}\\}`)
      expect(workspace).toMatch(button)
    }
  })

  it("keep the Excel button off until there is a report to export, and while a download is out", () => {
    expect(workspace).toMatch(/onClick=\{handleDownloadExcel\}\s+disabled=\{!report \|\| excelState === "preparing"\}/)
  })
})

describe("the period's recommendations table", () => {
  it("has a filter for all recommendations, OAR or stock items, in the card's header", () => {
    expect(render(management())).toContain("Show recommendations for")
    expect(viewSource).toContain("RECOMMENDATION_TYPE_OPTIONS") // the same OAR / Stock item groups as the Recommendations page
    expect(viewSource).toContain('type: type === "all" ? undefined : type') // "all" sends no type, so nothing is left out
  })

  it("goes back to the first page when the group changes", () => {
    expect(viewSource).toMatch(/setType\(next\)\s+setPage\(1\)/)
  })

  it("keeps Previous and Next on screen, switched off where there is nowhere to go", () => {
    expect(viewSource).toContain("alwaysShowButtons")
  })

  it("shows only the recommended values, not current → recommended", () => {
    for (const field of ["safetyStock", "rop", "maxStock"]) {
      expect(viewSource).toContain(`rec.recommended.${field}`)
      expect(viewSource).not.toContain(`rec.current.${field}`)
    }
  })
})

describe("the activity table", () => {
  it("shows each month, the quarter total, and a dash -- not a zero -- for a month that is not available", () => {
    const html = render(management())
    expect(html).toContain("Oct 2026")
    expect(html).toContain("Quarter total")
    expect(html).toContain("18,627")
    expect(html).toContain("Not measured by month.")
    expect(html).toContain("it is not a count of zero")
  })
})

describe("the Overview's charts", () => {
  it("has the four the Overview has", () => {
    const html = render(management())
    for (const title of ["Stockout Risk Distribution", "Stockout risk by plant", "Excess inventory by plant", "SAP adoption"]) {
      expect(html).toContain(title)
    }
  })

  it("has none the Overview does not: no Recommendation status, Forecast vs Actual or stockout trend", () => {
    const html = render(management())
    expect(html).not.toMatch(/Recommendation status/i)
    expect(html).not.toMatch(/Forecast vs Actual/i)
    expect(html).not.toMatch(/Stockout risk trend/i)
  })

  it("does not draw a stale stockout measurement as the period's position, and says why", () => {
    const html = render(management({}, true))
    expect(html).toContain("last measured on 31 May 2026")
    expect(html).not.toContain("9,916")  // the evaluated denominator of the distribution is not shown
    expect(html).toContain("Excess inventory by plant")  // the excess chart does not depend on the usage
  })

  it("draws the stockout figures when the measurement is current", () => {
    expect(render(management())).toContain("891")
  })

  it("shows the Overview's adoption counts, and the reason when the backend sent none", () => {
    expect(render(management())).toContain("3911")
    const html = render(management({ adoption: { status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 3, reason: "Not measured: no SAP change evidence." } }))
    expect(html).toContain("Not measured: no SAP change evidence.")
  })
})

describe("the stock level table and the coverage", () => {
  it("keeps the Stock level / Current (SAP) / Recommended / Change table, for one material, with a search and no averages", () => {
    const html = render(management())
    expect(html).toContain("Current SAP vs I07 recommendation")
    expect(html).toContain("Search a material")
    expect(html).toContain("border-action bg-action/10") // the search box wears the blue filter style
    expect(html).not.toContain("Current (SAP), average")
    expect(html).not.toContain("Recommended, average")
    for (const heading of ["Stock level", "Current (SAP)", "Recommended", "Change"]) {
      expect(viewSource).toContain(`>${heading}</TableHead>`)
    }
    for (const level of ["Safety stock", "Reorder point", "Maximum stock"]) expect(viewSource).toContain(`label: "${level}"`)
    expect(viewSource).toContain("search: query || undefined") // the search goes to the backend, over every material
  })

  it("opens on the period's latest recommendation, and steps through the matches one at a time", () => {
    expect(viewSource).toContain("const COMPARE_PAGE_SIZE = 1") // one recommendation per page ...
    expect(viewSource).toMatch(/sort: "generated_at",\s+sortDesc: true,\s+page,\s+pageSize: COMPARE_PAGE_SIZE/) // ... newest first
  })

  it("works out the change from SAP's figure to the recommended one, and none from a missing figure", () => {
    expect(stockChange(2, 12)).toEqual({ delta: 10, percent: 500 })
    expect(stockChange(100, 60)).toEqual({ delta: -40, percent: -40 })
    expect(stockChange(0, 12)).toEqual({ delta: 12, percent: null }) // no percentage from a starting 0
    expect(stockChange(null, 12)).toBeNull()
    expect(stockChange(2, null)).toBeNull()
  })

  it("reads a figure the backend did not send as missing, never as 0 set in SAP", () => {
    const rec = {
      current: { rop: 2, safetyStock: 0, maxStock: 100 },
      recommended: { rop: 12, safetyStock: 0, maxStock: 60 },
      present: {
        current: { rop: true, safetyStock: false, maxStock: true },
        recommended: { rop: true, safetyStock: true, maxStock: true },
      },
    } as unknown as Recommendation
    expect(stockFigure(rec, "current", "safetyStock")).toBeNull() // SAP has no safety stock for it
    expect(stockFigure(rec, "recommended", "safetyStock")).toBe(0) // a recommended 0 is a real 0
    expect(stockFigure(rec, "current", "rop")).toBe(2)
    expect(stockFigure({ ...rec, present: undefined } as Recommendation, "current", "safetyStock")).toBe(0) // an older mapper
  })

  it("lists every warning and says whether the figures are snapshots or current calculations", () => {
    const html = render(management())
    expect(html).toContain("Staged SAP consumption ends in May 2026")
    expect(html).toContain("Current calculations")
    expect(html).toContain("Not covered")
  })

  it("marks an incomplete period as in progress", () => {
    const html = render(management({ period: { status: "IN_PROGRESS", cutoff: "2026-10-21", months: MONTHS, note: "Q4 is still in progress." } }))
    expect(html).toContain("In progress")
    expect(html).toContain("Q4 is still in progress.")
  })
})

describe("the period of the list at the bottom", () => {
  it("is half-open: the day after the last day is the exclusive bound", () => {
    expect(dayAfter("2026-12-31")).toBe("2027-01-01")
    expect(dayAfter("2026-09-30")).toBe("2026-10-01")
    expect(dayAfter("2028-02-28")).toBe("2028-02-29")
  })
})

describe("an old saved report", () => {
  it("is offered for regeneration, and does not fetch the sample that made its charts wrong", () => {
    expect(workspace).toContain("<RegenerateBanner")
    expect(workspace).toContain("report && !report.management ? { pageSize: 200 } : {}")
    expect(workspace).toContain("report && report.management && <QuarterlyManagementView")
  })

  it("leaves Q2 2026 to its own view", () => {
    expect(workspace).toContain("<QuarterlySnapshotReport")
    expect(workspace).toContain('useQuarterlyReport(tab === "report" && !isSnapshot ?')
  })
})

describe("trends and the quarter-end position in the page", () => {
  const trends = {
    months: [{ month: "2026-10-01", label: "Oct 2026", state: "FINAL" as const, measured_on: "2026-11-03", month_end_valid: true, stockout_valid: true,
      population: 1, stockout_at_risk: 5, stockout_evaluated: 50, stockout_insufficient: 0, excess_count: 1, excess_opportunity: "100.00",
      net_rop_value_impact: "-50.00", net_rop_change_from_previous: null, currency: null, revision: 1, calc_version: "1", note: null }],
    quarter_end: { status: "NOT_AVAILABLE" as const, month: "2026-12-01", label: "Dec 2026", snapshot_state: "MISSING", measured_on: null,
      reason: "No snapshot was captured for Dec 2026.", population: null, stock_levels: [], latest_available_month: null,
      latest_available_label: null, latest_available_measured_on: null },
    notes: [],
  }

  it("draws the monthly trends and the quarter-end card when the report has them", () => {
    const html = render(management({ trends }))
    for (const subtitle of ["Materials at risk each month", "Stock above the recommended maximum", "Cash freed (+) or tied up (−)"]) {
      expect(html).toContain(subtitle) // the three monthly trend cards
    }
    expect(html).toContain("Quarter-end position")
    expect(html).toContain("No snapshot was captured for Dec 2026.")
  })

  it("leaves them out for a report made before snapshots, rather than showing empty cards", () => {
    const html = render(management())
    expect(html).not.toContain("Materials at risk each month")
    expect(html).not.toContain("Quarter-end position")
  })

  it("says on a card when its figure is a saved month-end snapshot", () => {
    const html = render(management({ kpis: [card("excess_inventory_opportunity", { basis: "snapshot", period_label: "Dec 2026 month-end" })] }))
    expect(html).toContain("Saved month-end snapshot")
    expect(html).toContain("Dec 2026 month-end")
    expect(render(management({ kpis: [card("excess_inventory_opportunity")] }))).not.toContain("Saved month-end snapshot")
  })
})
