// The PDF of a quarterly report: the same file download as the monthly one, with what the quarterly page shows -- the three monthly
// trend charts over all three months of the quarter, the monthly trends table and the quarter-end position -- instead of the monthly
// report's last-months charts. The monthly PDF is not touched by any of it.

import { writeFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { composeReportPdf } from "@/features/initiative-7/utils/report-pdf"

const fig = {
  population: 18575, stockout: { at_risk: 891, evaluated: 4000, insufficient_data: 120, as_of: "2026-12-30", stale: false, stale_note: null },
  excess_count: 374, excess_opportunity: "12828442", net_rop_value_impact: "0", priced_count: 0, currency: "ZAR", working_capital_currency: "ZAR",
}

const month = (label: string, over: object = {}) => ({
  month: label, label, state: "FINAL", measured_on: "2027-01-04", month_end_valid: true, stockout_valid: true, population: 100,
  stockout_at_risk: 800, stockout_evaluated: 4000, stockout_insufficient: 10, excess_count: 300, excess_opportunity: "9000000",
  net_rop_value_impact: "-1500000", net_rop_change_from_previous: null, currency: "ZAR", note: null, ...over,
})

const trends = {
  months: [
    month("Oct 2026", { stockout_at_risk: 750, excess_opportunity: "9000000", net_rop_value_impact: "-1500000" }),
    month("Nov 2026", { state: "MISSING", measured_on: null, stockout_at_risk: null, excess_opportunity: null, net_rop_value_impact: null, note: "No snapshot was captured for Nov 2026." }),
    month("Dec 2026", { stockout_at_risk: 891, excess_opportunity: "12828442", net_rop_value_impact: "-2500000", net_rop_change_from_previous: null }),
  ],
  quarter_end: {
    status: "AVAILABLE", month: "2026-12-01", label: "Dec 2026", snapshot_state: "FINAL", measured_on: "2027-01-04", reason: null, population: 100,
    stock_levels: [
      { key: "safety_stock", label: "Safety stock", aggregation: "mean", records: 120, current: "2.0", recommended: "3.5" },
      { key: "reorder_point", label: "Reorder point", aggregation: "mean", records: 120, current: "5.0", recommended: "6.5" },
      { key: "max_stock", label: "Maximum stock", aggregation: "mean", records: 118, current: "9.0", recommended: "10.0" },
    ],
    latest_available_month: null, latest_available_label: null, latest_available_measured_on: null,
  },
  notes: ["Realised savings are not measured."],
}

const management = (over: object = {}) =>
  ({
    period: { status: "COMPLETE", cutoff: "2026-12-31", months: [], note: "Q4 2026 is complete." },
    monthly_activity: {
      months: [{ label: "Oct 2026" }, { label: "Nov 2026" }, { label: "Dec 2026" }],
      rows: [{ key: "a", label: "Recommendations generated", unit: "recommendations", months: [5, 6, 7], quarter_total: 18, note: "n" }],
    },
    kpis: [], position: fig, plant_positions: [{ plant: null, figures: fig }], status_distribution: { rows: [] },
    forecast_actual: { status: "NOT_AVAILABLE", months: [], note: "n" },
    adoption: { status: "UNKNOWN", tracked: 0, pending: 0, reason: "r", pending_approvals: 0, stages: null },
    data_coverage: { basis: "snapshot", months: [], warnings: [], items: [] },
    performance: { months: [{ label: "Dec 2026", records_generated: 3, material_plants_generated: 3, submitted: 0, approved: 0, rejected: 0, sent_back: 0, excess_state: "MONTH_END", excess_opportunity: "100" }], notes: [] },
    trends, definitions: [], ...over,
  }) as unknown as ApiQuarterManagement

const quarterly = { metadata: { quarter: "Q4 2026", period_start: "2026-10-01", period_end: "2026-12-31", generated_at: "2027-01-05T10:00:00Z", report_version: "1.2" } } as unknown as ApiQuarterlyReport
const monthly = { metadata: { quarter: "Oct 2026", period_start: "2026-10-01", period_end: "2026-10-31", generated_at: "2026-11-05T10:00:00Z", report_version: "1.2" } } as unknown as ApiQuarterlyReport
const none = { eligibleOar: [], eligibleOarTotal: 0, adopted: [], adoptedTotal: 0 }

const out = async (report: ApiQuarterlyReport, m: ApiQuarterManagement) => (await composeReportPdf({ report, management: m, ...none })).output()

describe("the PDF of a quarterly report", () => {
  it("is the quarterly report: its title, and its tables named for the quarter", async () => {
    const text = await out(quarterly, management())
    expect(text).toContain("Quarterly Deep-Dive Report")
    expect(text).toContain("Current vs recommended in Q4 2026")
    expect(text).toContain("Adopted recommendations in Q4 2026")
  })

  it("has the monthly trends over all three months, with the month that has no snapshot named, never as a zero", async () => {
    const text = await out(quarterly, management())
    expect(text).toContain("Monthly Trends")
    for (const label of ["Oct 2026", "Nov 2026", "Dec 2026"]) expect(text).toContain(label)
    expect(text).toContain("At stockout risk")
    expect(text).toContain("Excess inventory opportunity")
    expect(text).toContain("Working capital impact")
    expect(text).toContain("No figure for Nov 2026.")
    expect(text).toContain("No snapshot was captured for Nov 2026.")
    expect(text).toContain("Realised savings are not measured.")
  })

  it("has the quarter-end position from the last month's snapshot, and says why when there is none", async () => {
    const text = await out(quarterly, management())
    expect(text).toContain("Quarter-end position")
    expect(text).toContain("The saved Dec 2026 month-end snapshot")
    expect(text).toContain("3.5")
    const none_ = management({
      trends: { ...trends, quarter_end: { ...trends.quarter_end, status: "NOT_AVAILABLE", stock_levels: [], reason: "No valid Dec 2026 snapshot.", latest_available_label: "Oct 2026", latest_available_measured_on: "2026-11-03" } },
    })
    const unavailable = await out(quarterly, none_)
    expect(unavailable).toContain("No valid Dec 2026 snapshot.")
    expect(unavailable).toContain("It is not shown as the quarter-end.")
  })

  it("leaves out the monthly report's last-months charts, which the quarterly page does not show", async () => {
    const text = await out(quarterly, management())
    expect(text).not.toContain("Approval activity")
    expect(text).not.toContain("Excess inventory trend")
  })

  it("leaves the monthly report as it was: its charts, and no quarterly trend sections", async () => {
    const text = await out(monthly, management())
    expect(text).toContain("Approval activity")
    expect(text).toContain("Excess inventory trend")
    expect(text).not.toContain("Monthly Trends")
    expect(text).not.toContain("Quarter-end position")
  })

  it("does not draw the trend sections for a quarterly report saved before the snapshots", async () => {
    const text = await out(quarterly, management({ trends: null }))
    expect(text).not.toContain("Monthly Trends")
    expect(text).not.toContain("Quarter-end position")
  })

  it.skipIf(!process.env.SAMPLE_PDF)("writes a sample to look at", async () => {
    const pdf = await composeReportPdf({ report: quarterly, management: management(), ...none })
    writeFileSync(process.env.SAMPLE_PDF as string, Buffer.from(pdf.output("arraybuffer")))
  })
})
