// The report as a PDF file: it carries what the page shows (cards, the two material tables, the charts, the activity, the
// coverage and how each number is worked out), builds as a real PDF, and writes working capital the way the page does.

import { describe, expect, it } from "vitest"

import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { buildReportPdf, composeReportPdf, periodNameOf, reportPdfFilename } from "@/features/initiative-7/utils/report-pdf"

const card = (key: string, over: Partial<ApiKpiCard> = {}): ApiKpiCard =>
  ({
    key, title: `Backend title ${key}`, unit: "ZAR", value: "0", status: "AVAILABLE", explanation: `Explains ${key}.`, kind: "MEASUREMENT",
    measured_on: null, period_label: "Oct 2026", denominator: 0, denominator_label: "stock items included", basis: "current_calculation",
    unavailable_reason: null, note: null, ...over,
  }) as unknown as ApiKpiCard

const figures = {
  population: 100, stockout: { at_risk: 0, evaluated: 0, insufficient_data: 0, as_of: "2026-07-30", stale: true, stale_note: "Stockout risk was last measured on 30 Jul 2026." },
  excess_count: 374, excess_opportunity: "12828442", net_rop_value_impact: "0", priced_count: 0, currency: "ZAR", working_capital_currency: "ZAR",
}

const management = {
  period: { status: "COMPLETE", cutoff: "2026-10-31", months: [], note: "Oct 2026 is complete." },
  monthly_activity: {
    months: [{ label: "Oct 2026" }],
    rows: [{ key: "recommendations_generated", label: "Recommendations generated", unit: "recommendations", months: [1229], quarter_total: 1229, note: "A note." }],
  },
  kpis: [
    card("critical_stockout_risk", { value: null, status: "NOT_AVAILABLE", unit: "material-plants" }),
    card("working_capital_oar", { value: "100", title: "Working capital impact: OAR", denominator: 4, denominator_label: "OAR materials included" }),
    card("materials_assessed"), // not a card on the page, so not in the PDF
  ],
  position: { ...figures },
  plant_positions: [{ plant: null, figures }, { plant: "1300", figures: { ...figures, excess_count: 231 } }],
  status_distribution: { rows: [] },
  forecast_actual: { status: "NOT_AVAILABLE", months: [], note: "No backtest for these months." },
  adoption: { status: "UNKNOWN", tracked: 1229, adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 1229, reason: "No SAP change evidence yet.", pending_approvals: 0,
    stages: { total: 1229, not_submitted: 1228, awaiting_approval: 1, adjusted_in_chain: 0, approved_awaiting_sap: 0, implemented_in_sap: 0, rejected_or_sent_back: 0, other: 0 } },
  data_coverage: {
    basis: "snapshot", months: [{ month: "2026-10-01", label: "Oct 2026", consumption_status: "NOT_COVERED", recommendations_generated: 21343 }],
    warnings: ["A coverage warning."], items: [{ key: "stockout", label: "Latest stockout measurement", value: "30 Jul 2026", status: "Stale", detail: "Too old." }],
  },
  performance: { months: [{ label: "Sep 2026", records_generated: null, material_plants_generated: null, submitted: null, approved: null, rejected: null, sent_back: null, excess_state: "MISSING", excess_opportunity: null },
    { label: "Oct 2026", records_generated: 21343, material_plants_generated: 18575, submitted: 0, approved: 0, rejected: 0, sent_back: 0, excess_state: "MONTH_END", excess_opportunity: "100" }], notes: [] },
  definitions: ["A definition of a kind of figure."],
} as unknown as ApiQuarterManagement

const report = {
  metadata: { quarter: "Oct 2026", period_start: "2026-10-01", period_end: "2026-10-31", generated_at: "2026-11-05T10:00:00Z", report_version: "1.2" },
} as unknown as ApiQuarterlyReport

const rec = (id: string): Recommendation =>
  ({
    id, material: { description: "ELEMENT,FILTER", materialCode: "5000080191" }, plantId: "1300",
    current: { safetyStock: 0, rop: 0, maxStock: 0 }, recommended: { safetyStock: 1, rop: 4, maxStock: 5 },
  }) as unknown as Recommendation

const text = async (input: Parameters<typeof composeReportPdf>[0]) => (await composeReportPdf(input)).output()

const base = { report, management, eligibleOar: [rec("1")], eligibleOarTotal: 4, adopted: [], adoptedTotal: 0 }

describe("the report as a PDF file", () => {
  it("is a real PDF, named for the report, and says how big it is by pages", async () => {
    const blob = await buildReportPdf(base)
    expect(blob.size).toBeGreaterThan(5_000)
    expect(await blob.slice(0, 5).text()).toBe("%PDF-")
    expect(reportPdfFilename(report)).toBe("i7-monthly-report-Oct_2026.pdf")
    expect((await composeReportPdf(base)).getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("carries the page's sections in its words: the two tables, the charts, the activity and the coverage", async () => {
    const out = await text(base)
    for (const heading of [
      "Monthly Report", "Key figures", "Current vs recommended in Oct 2026", "Adopted recommendations in Oct 2026", "Stockout Risk Distribution",
      "Approval status", "SAP adoption", "Activity by month", "Data coverage and limitations", "How each number is worked out",
    ]) expect(out).toContain(heading)
    expect(out).toContain("5000080191") // an eligible OAR material, with its code
    expect(out).toContain("No recommendation generated in this period has been adopted in SAP yet.")
    expect(out).toContain("A coverage warning.")
  })

  it("shows the cards the page shows, and leaves out a card the page does not", async () => {
    const out = await text(base)
    expect(out).toContain("Working capital impact: OAR")
    expect(out).toContain("High Stockout Risk")
    expect(out).not.toContain("Explains materials_assessed.")
    expect(out).toContain("Explains working_capital_oar.") // under how each number is worked out
  })

  it("says Not available, with the reason, for a stockout reading that was too old -- never a chart of it", async () => {
    const out = await text(base)
    expect(out).toContain("Not available")
    expect(out).toContain("Stockout risk was last measured on 30 Jul 2026.")
  })

  it("names the period the way the page does: the month for a monthly report, the quarter otherwise", () => {
    expect(periodNameOf(report)).toBe("Oct 2026")
    const quarter = { metadata: { quarter: "Q4 2026", period_start: "2026-10-01", period_end: "2026-12-31" } } as unknown as ApiQuarterlyReport
    expect(periodNameOf(quarter)).toBe("Q4 2026")
  })
})
