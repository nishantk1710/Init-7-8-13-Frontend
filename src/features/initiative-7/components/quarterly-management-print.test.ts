// The PDF of a generated quarterly report with the management view: that it prints the saved report's own figures, says Not
// available (with the reason) instead of a dash or a zero, never prints a stale stockout reading as the period's position, and
// is chosen for the new report while an older saved report keeps its older print view.
//
// Rendered to static markup (this project's vitest runs without a DOM).

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ManagementPrintView } from "@/features/initiative-7/components/quarterly-management-print"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

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

function management(staleStockout = false, withTrends = true): ApiQuarterManagement {
  const stockout = staleStockout
    ? { at_risk: 891, evaluated: 9916, insufficient_data: 503, as_of: "2026-05-31", stale: true, stale_note: "Stockout risk was last measured on 31 May 2026, 214 days before this report's cutoff." }
    : { at_risk: 891, evaluated: 9916, insufficient_data: 503, as_of: "2026-12-31", stale: false, stale_note: null }
  const figures = (population: number, atRisk: number, excess: number) => ({
    population, stockout: { ...stockout, at_risk: atRisk }, excess_count: excess, excess_opportunity: "1500000.00",
    net_rop_value_impact: "-2000000.00", priced_count: population, currency: null,
  })
  return {
    period: { status: "COMPLETE", cutoff: "2026-12-31", months: MONTHS, note: "Oct 2026 – Dec 2026 is complete." },
    monthly_activity: {
      months: MONTHS,
      rows: [
        { key: "recommendations_generated", label: "Recommendations generated", unit: "records", kind: "EVENT", months: [18627, 0, 0], quarter_total: 18627, status: "AVAILABLE", reconciles: true, note: "Records, not distinct materials." },
        { key: "sap_adoptions_confirmed", label: "Confirmed SAP adoptions", unit: "adoptions", kind: "EVENT", months: [null, null, null], quarter_total: null, status: "UNKNOWN", reconciles: null, note: "Not measured by month." },
      ],
    },
    kpis: [card("materials_assessed", { value: "18627", denominator: 18700, denominator_label: "material-plants" }), card("critical_stockout_risk", staleStockout ? { value: null, status: "NOT_AVAILABLE", unavailable_reason: "Last measured on 31 May 2026." } : { value: "891" })],
    position: figures(18627, 891, 727),
    plant_positions: [
      { plant: null, figures: figures(18627, 891, 727) },
      { plant: "1300", figures: figures(10881, 432, 347) },
      { plant: "1500", figures: figures(7746, 459, 380) },
    ],
    status_distribution: { kind: "STATUS_AS_OF", basis: "Current status", measured_on: "2027-01-15", total: 1, rows: [] },
    forecast_actual: { status: "NOT_AVAILABLE", months: [], forecast_total: null, actual_total: null, accuracy: null, forecast_run_id: null, note: "No forecast run has succeeded." },
    adoption: { status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 3, reason: "Not measured: no SAP change evidence.", tracked: 3911, adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 3911 },
    data_coverage: {
      latest_consumption_date: "2026-05-30", latest_consumption_month: "2026-05-01", latest_stock_loaded_at: "2026-10-20T10:00:00Z",
      stockout_usage_as_of: "2026-05-31",
      months: MONTHS.map((m) => ({ month: m.month, label: m.label, consumption_status: m.usable ? ("AVAILABLE" as const) : ("NOT_COVERED" as const), recommendations_generated: m.usable ? 18627 : 0 })),
      eligible_recommendations: 18627, eligible_material_plants: 18600, basis: "current_calculation",
      warnings: ["Staged SAP consumption ends in May 2026, so Oct 2026 have no consumption data."],
    },
    trends: withTrends
      ? {
          months: [{ month: "2026-10-01", label: "Oct 2026", state: "FINAL", measured_on: "2026-11-03", month_end_valid: true, stockout_valid: false, population: 10,
            stockout_at_risk: null, stockout_evaluated: null, stockout_insufficient: null, excess_count: 3, excess_opportunity: "1500000.00",
            net_rop_value_impact: "-2000000.00", net_rop_change_from_previous: null, currency: null, revision: 1, calc_version: "1", note: "Stockout risk not shown: its usage was last built 31 May 2026." }],
          quarter_end: { status: "NOT_AVAILABLE", month: "2026-12-01", label: "Dec 2026", snapshot_state: "MISSING", measured_on: null, reason: "No snapshot was captured for Dec 2026.",
            population: null, stock_levels: [], latest_available_month: "2026-10-01", latest_available_label: "Oct 2026", latest_available_measured_on: "2026-11-03" },
          notes: ["Realised savings are not measured."],
        }
      : null,
    position_basis: "current_calculation",
    definitions: ["Event in the period: something that happened during it."],
  } as unknown as ApiQuarterManagement
}

const report = (m: ApiQuarterManagement): ApiQuarterlyReport =>
  ({
    metadata: { quarter: "Q4 2026", period_start: "2026-10-01", period_end: "2026-12-31", generated_at: "2027-01-15T00:00:00Z", report_version: "1.2" },
    baseline_comparison: { rows: [{ metric: "ROP", baseline_value: "10", recommendation_value: "20", delta: "10", delta_percentage: "100", both_available_count: 3911 }] },
    limitations: { items: ["SAP adoption has never been measured."] },
    management: m,
  }) as unknown as ApiQuarterlyReport

const rec = (id: string): Recommendation =>
  ({
    id, material: { materialId: id, description: `Material ${id}` }, plantId: "1300", criticality: "High", demandPattern: "Lumpy",
    current: { rop: 2, safetyStock: 1, maxStock: 10 }, recommended: { rop: 12, safetyStock: 3, maxStock: 8 }, status: "Pending Review",
    generatedAt: "14 Oct 2026",
  }) as unknown as Recommendation

function html(m: ApiQuarterManagement = management(), materials: Recommendation[] = [rec("A"), rec("B")], total = 18627): string {
  return renderToStaticMarkup(createElement(ManagementPrintView, { report: report(m), management: m, materials, materialsTotal: total }))
}

describe("the PDF carries the saved report's own figures", () => {
  it("has the period, the summary with each figure's kind, date and denominator, and where each is from", () => {
    const out = html()
    expect(out).toContain("Q4 2026")
    expect(out).toContain("Complete")
    expect(out).toContain("Title materials_assessed")
    expect(out).toContain("18,627")
    expect(out).toContain("of 18,700 material-plants")
    expect(out).toContain("Event in the period")
    expect(out).toContain("Current calculation")
  })

  it("has the monthly activity table with the three months and the quarter total", () => {
    const out = html()
    expect(out).toContain("Oct 2026")
    expect(out).toContain("Nov 2026")
    expect(out).toContain("Dec 2026")
    expect(out).toContain("Quarter total")
    expect(out).toContain("Records, not distinct materials.")
  })

  it("has the by-plant table, the adoption counts, the stock levels with their record counts and the data coverage", () => {
    const out = html()
    expect(out).toContain("All plants")
    expect(out).toContain("Black Mountain")
    expect(out).toContain("3,911")
    expect(out).toContain("3,911")  // the records behind the stock-level average
    expect(out).toContain("Staged SAP consumption ends in May 2026")
  })

  it("lists the period's recommendations as a list and says it is not the population behind the figures", () => {
    const out = html()
    expect(out).toContain("Recommendations Generated in Q4 2026")
    expect(out).toContain("2 of 18,627 recommendations generated in this period")
    expect(out).toContain("not the population the figures above are over")
    expect(out).toContain("Material A")
  })
})

describe("what is not available is said, not drawn as zero", () => {
  it("prints Not available and the reason for a stockout reading too old for the period, never the stale count", () => {
    const out = html(management(true))
    expect(out).toContain("Not available")
    expect(out).toContain("last measured on 31 May 2026")
    expect(out).not.toContain("9,916")
  })

  it("prints the quarter-end as Not available with its reason, and the latest snapshot without calling it the quarter-end", () => {
    const out = html()
    expect(out).toContain("No snapshot was captured for Dec 2026.")
    expect(out).toContain("The latest snapshot available is Oct 2026")
    expect(out).toContain("not shown as the quarter-end")
  })

  it("prints a month with no figure as Not available in the activity table", () => {
    expect(html()).toContain("Not available")
  })

  it("says counts are never added across months and that money figures are estimates", () => {
    const out = html()
    expect(out).toContain("never added into a quarter total")
    expect(out).toContain("estimates of what the recommendations would change")
  })
})

describe("an older report and a report without trends", () => {
  it("leaves the trend and quarter-end sections out when the report has none, rather than printing empty ones", () => {
    const out = html(management(false, false))
    expect(out).not.toContain("Monthly Trends")
    expect(out).not.toContain("Quarter-End Position")
  })

  it("is chosen only for a report with the management view; an older one keeps its print view", () => {
    expect(workspace).toContain("report.management ? (")
    expect(workspace).toContain("<ManagementPrintView")
    expect(workspace).toContain("<ReportPrintView")
  })

  it("prints this period's recommendations for the new report, and the unscoped list for an old one", () => {
    expect(workspace).toContain("...(report.management")
    expect(workspace).toContain("generatedFrom: `${report.metadata.period_start}T00:00:00`")
  })
})
