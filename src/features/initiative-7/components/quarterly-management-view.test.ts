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

import { QuarterlyManagementView, dayAfter } from "@/features/initiative-7/components/quarterly-management-view"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const workspace = read("src/features/initiative-7/components/quarterly-reports-workspace.tsx")

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
    expect(html).toContain("Explains materials_assessed.")
    expect(html).toContain("18,627")
    expect(html).toContain("of 18,700 material-plants with a recommendation")
    expect(html).toContain("as of 15 Jan 2027")
    expect(html).toContain("Status on a date")
  })

  it("say Not available and why, never 0, when a figure has no value", () => {
    const m = management({ kpis: [card("critical_stockout_risk", { value: null, status: "NOT_AVAILABLE", unavailable_reason: "Last measured on 31 May 2026." })] })
    const html = render(m)
    expect(html).toContain("Not available")
    expect(html).toContain("Last measured on 31 May 2026.")
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
  it("says how many recommendations each average is over", () => {
    const html = render(management())
    expect(html).toContain("Records")
    expect(html).toContain("3,911")
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
