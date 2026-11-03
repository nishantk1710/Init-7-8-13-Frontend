// The PDF of a monthly report: it prints the same sections the page shows, from the saved report -- the performance trends with
// their gaps, the approval stages apart from SAP adoption, the coverage statuses and the comparison rows -- and says Not available,
// with the reason, wherever a figure was not measured.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ManagementPrintView } from "@/features/initiative-7/components/quarterly-management-print"
import type { ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const workspace = readFileSync(join(process.cwd(), "src/features/initiative-7/components/quarterly-reports-workspace.tsx"), "utf8")

const MONTH = [{ month: "2026-10-01", label: "Oct 2026", state: "ended", has_consumption_data: false, usable: false }]
const stockout = { at_risk: 5, evaluated: 50, insufficient_data: 1, as_of: "2026-10-30", stale: false, stale_note: null }
const figures = (over: object = {}) => ({
  population: 1000,
  stockout,
  excess_count: 40,
  excess_opportunity: "5000000.00",
  net_rop_value_impact: "-2000000.00",
  priced_count: 900,
  currency: "ZAR",
  working_capital_currency: "ZAR",
  working_capital_excluded_count: 100,
  inventory_value: "120000000.00",
  inventory_priced_count: 800,
  safety_stock_value: "9000000.00",
  safety_stock_priced_count: 850,
  below_reorder_count: 70,
  below_reorder_judged: 600,
  inventory_stock_as_of: "2026-10-30",
  inventory_unavailable_reason: null,
  recommendation_reference_date: "2026-10-31",
  ...over,
})

const quarterEnd = (over: object = {}) => ({
  status: "AVAILABLE",
  month: "2026-10-01",
  label: "Oct 2026",
  snapshot_state: "FINAL",
  measured_on: "2026-11-02",
  reason: null,
  population: 1000,
  stock_levels: [],
  latest_available_month: null,
  latest_available_label: null,
  latest_available_measured_on: null,
  ...over,
})

const pmonth = (label: string, over: object = {}) => ({
  month: "2026-10-01",
  label,
  state: "ended",
  records_generated: null,
  material_plants_generated: null,
  submitted: null,
  approved: null,
  rejected: null,
  sent_back: null,
  excess_state: "MISSING",
  excess_count: null,
  excess_opportunity: null,
  currency: null,
  ...over,
})

function management(over: Record<string, unknown> = {}, snapshot = true): ApiQuarterManagement {
  return {
    period: { status: "COMPLETE", cutoff: "2026-10-31", months: MONTH, note: "Oct 2026 is complete." },
    monthly_activity: {
      months: MONTH,
      rows: [
        {
          key: "recommendations_generated",
          label: "Recommendations generated",
          unit: "records",
          kind: "EVENT",
          months: [21343],
          quarter_total: 21343,
          status: "AVAILABLE",
          reconciles: true,
          note: null,
        },
      ],
    },
    kpis: [],
    position: figures(),
    position_basis: snapshot ? "snapshot" : "current_calculation",
    plant_positions: [{ plant: null, figures: figures() }],
    status_distribution: { kind: "STATUS_AS_OF", basis: "Current status", measured_on: "2026-11-03", total: 3, rows: [] },
    forecast_actual: {
      status: "NOT_AVAILABLE",
      months: [],
      forecast_total: null,
      actual_total: null,
      accuracy: null,
      forecast_run_id: null,
      note: "No forecast.",
    },
    adoption: {
      status: "UNKNOWN",
      confirmed_adoptions: null,
      pending_approvals: 5,
      reason: "Not measured.",
      tracked: 50,
      adopted: 0,
      partially_adopted: 0,
      not_adopted: 0,
      pending: 50,
      adoption_rate: null,
      stages: {
        total: 100,
        not_submitted: 60,
        awaiting_approval: 5,
        adjusted_in_chain: 1,
        approved_awaiting_sap: 20,
        implemented_in_sap: 4,
        rejected_or_sent_back: 10,
        other: 0,
      },
    },
    data_coverage: {
      latest_consumption_date: null,
      latest_consumption_month: null,
      latest_stock_loaded_at: null,
      stockout_usage_as_of: null,
      months: [],
      eligible_recommendations: 21343,
      eligible_material_plants: 1705,
      basis: snapshot ? "snapshot" : "current_calculation",
      warnings: ["A warning."],
      items: [
        {
          key: "stockout",
          label: "Latest stockout measurement",
          value: "31 May 2026",
          status: "Stale",
          detail: "Last measured 31 May 2026.",
        },
      ],
    },
    trends: {
      months: [],
      quarter_end: quarterEnd(snapshot ? {} : { status: "NOT_AVAILABLE", reason: "No snapshot was captured for Oct 2026." }),
      notes: [],
    },
    performance: {
      months: [
        pmonth("Sep 2026"),
        pmonth("Oct 2026", {
          records_generated: 21343,
          material_plants_generated: 18575,
          submitted: 0,
          approved: 0,
          rejected: 0,
          sent_back: 0,
          excess_state: "MONTH_END",
          excess_opportunity: "5000000.00",
          currency: "ZAR",
        }),
      ],
      recommendation_history_from: "2026-10-01",
      approval_history_from: "2026-10-01",
      notes: ["SAP implementation has no monthly series."],
    },
    definitions: ["Event in the period."],
    ...over,
  } as unknown as ApiQuarterManagement
}

const report = (m: ApiQuarterManagement): ApiQuarterlyReport =>
  ({
    metadata: {
      quarter: "Oct 2026",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      generated_at: "2026-11-03T00:00:00Z",
      report_version: "1.2",
    },
    baseline_comparison: { rows: [] },
    limitations: { items: [] },
    management: m,
  }) as unknown as ApiQuarterlyReport

const rec = (id: string, over: object = {}): Recommendation =>
  ({
    id,
    material: { materialId: id, description: `Material ${id}` },
    plantId: "1300",
    criticality: "High",
    demandPattern: "Lumpy",
    status: "Pending Review",
    generatedAt: "31 Oct 2026",
    current: { rop: 2, safetyStock: 0, maxStock: 100 },
    recommended: { rop: 12, safetyStock: 3, maxStock: 60 },
    present: { current: { rop: true, safetyStock: false, maxStock: true }, recommended: { rop: true, safetyStock: true, maxStock: true } },
    ...over,
  }) as unknown as Recommendation

const html = (m: ApiQuarterManagement, comparison: Recommendation[] = [rec("A")]) =>
  renderToStaticMarkup(
    createElement(ManagementPrintView, {
      report: report(m),
      management: m,
      materials: [],
      materialsTotal: 0,
      comparison,
      comparisonTotal: 7,
    }),
  )

describe("a monthly PDF", () => {
  it("is called a monthly report with a month total, and has no quarterly trend or quarter-end sections", () => {
    const out = html(management())
    expect(out).toContain("Monthly Report")
    expect(out).not.toContain("Quarterly Deep-Dive Report")
    expect(out).toContain("Month total")
    expect(out).not.toContain("Quarter total")
    expect(out).not.toContain("Monthly Trends")
    expect(out).not.toContain("Quarter-End Position")
  })

  it("has no month-end position section, as the page has none", () => {
    const out = html(management())
    expect(out).not.toContain("Month-End Position")
    expect(out).not.toContain("Snapshot not available")
  })

  it("prints the performance trends with a gap as Not available and a real zero as 0", () => {
    const out = html(management())
    expect(out).toContain("Monthly Performance and Trends")
    expect(out).toContain("Sep 2026")
    expect(out).toContain("Not available") // September: before any recommendation
    expect(out).toContain("21,343")
    expect(out).toContain("18,575")
    expect(out).toContain("SAP implementation has no monthly series.")
  })

  it("prints the approval stages apart from SAP adoption, with no adoption rate until SAP has evidence", () => {
    const out = html(management())
    expect(out).toContain("Approval Status")
    expect(out).toContain("Approved, awaiting SAP")
    expect(out).toContain("Approved is not adopted")
    expect(out).toContain("Not yet measured")
  })

  it("prints each coverage source with its status and reason", () => {
    const out = html(management())
    expect(out).toContain("Latest stockout measurement")
    expect(out).toContain("Stale")
    expect(out).toContain("Last measured 31 May 2026.")
  })

  it("prints the comparison rows with a dash for a value not set in SAP, never a zero", () => {
    const out = html(management())
    expect(out).toContain("1 of 7 recommendations with a recommended value")
    expect(out).toContain("Material A")
    expect(out).toContain("— → 3") // SAP has no safety stock; 3 is recommended
    expect(out).toContain("2 → 12 (+10)")
    expect(out).toContain("not a stock level of zero")
  })

  it("leaves the approval and performance sections out of an older report that has none, rather than printing empty ones", () => {
    const old = management({
      performance: null,
      adoption: { status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 0, reason: "r" },
    })
    const out = html(old, [])
    expect(out).not.toContain("Monthly Performance and Trends")
    expect(out).not.toContain("Approval Status")
  })

  it("fetches the PDF's comparison rows with the same has_recommended query as the page", () => {
    expect(workspace).toContain("hasRecommended: true")
    expect(workspace).toContain("comparison={pdfComparison ?? []}")
    expect(workspace).toContain("pdfMaterialsLoading || pdfComparisonLoading") // the print waits for them
  })
})
