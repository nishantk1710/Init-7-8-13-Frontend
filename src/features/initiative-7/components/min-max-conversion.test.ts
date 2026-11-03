// The OAR cards: how many of the period's records are OAR, and how many OAR material-plants may convert to Min-Max ordering -- with
// the second card opening the list of those materials, the same list the card counted.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ManagementPrintView } from "@/features/initiative-7/components/quarterly-management-print"
import { QuarterlyManagementView } from "@/features/initiative-7/components/quarterly-management-view"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { cardCaption, cardTitle, orderedKpis } from "@/features/initiative-7/utils/quarterly-management"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const dialogSource = read("src/features/initiative-7/components/min-max-conversion-dialog.tsx")
const viewSource = read("src/features/initiative-7/components/quarterly-management-view.tsx")
const workspace = read("src/features/initiative-7/components/quarterly-reports-workspace.tsx")

const TITLES: Record<string, string> = { oar_recommendations: "OAR recommendations", min_max_conversion: "Min-Max conversion" }

const card = (key: string, over: Partial<ApiKpiCard> = {}): ApiKpiCard => ({
  key,
  title: TITLES[key] ?? key,
  unit: "material-plants",
  value: "7",
  status: "AVAILABLE",
  explanation: `Explains ${key}.`,
  kind: "STATUS_AS_OF",
  measured_on: "2026-11-03",
  period_label: "as of 03 Nov 2026",
  denominator: 40,
  denominator_label: "OAR material-plants",
  basis: "current_calculation",
  unavailable_reason: null,
  note: null,
  ...over,
})

const stockout = { at_risk: 0, evaluated: 0, insufficient_data: 0, as_of: null, stale: false, stale_note: null }
const figures = {
  population: 1,
  stockout,
  excess_count: 0,
  excess_opportunity: null,
  net_rop_value_impact: null,
  priced_count: 0,
  currency: null,
}

function management(kpis: ApiKpiCard[]): ApiQuarterManagement {
  return {
    period: { status: "COMPLETE", cutoff: "2026-10-31", months: [], note: "Oct 2026 is complete." },
    monthly_activity: { months: [], rows: [] },
    kpis,
    position: figures,
    plant_positions: [{ plant: null, figures }],
    status_distribution: { kind: "STATUS_AS_OF", basis: "x", measured_on: "2026-11-03", total: 0, rows: [] },
    forecast_actual: {
      status: "NOT_AVAILABLE",
      months: [],
      forecast_total: null,
      actual_total: null,
      accuracy: null,
      forecast_run_id: null,
      note: "n",
    },
    adoption: { status: "UNKNOWN", confirmed_adoptions: null, pending_approvals: 0, reason: "r" },
    data_coverage: {
      latest_consumption_date: null,
      latest_consumption_month: null,
      latest_stock_loaded_at: null,
      stockout_usage_as_of: null,
      months: [],
      eligible_recommendations: 0,
      eligible_material_plants: 0,
      basis: "current_calculation",
      warnings: [],
    },
    definitions: [],
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

const page = (m: ApiQuarterManagement) => renderToStaticMarkup(createElement(QuarterlyManagementView, { report: report(m), management: m }))

describe("the OAR cards", () => {
  const kpis = [
    card("oar_recommendations", {
      unit: "recommendation records",
      kind: "EVENT",
      value: "1200",
      denominator: 21343,
      denominator_label: "recommendations generated in the period",
    }),
    card("min_max_conversion"),
  ]

  it("sit in the card order, with plain titles and one-line captions", () => {
    const ordered = orderedKpis(kpis).map((c) => c.key)
    expect(ordered).toEqual(["oar_recommendations", "min_max_conversion"])
    expect(cardTitle(card("min_max_conversion", { title: "Min-Max conversion" }))).toBe("Min-Max conversion")
    for (const key of ["oar_recommendations", "min_max_conversion"]) expect(cardCaption(card(key)).length).toBeLessThanOrEqual(50)
  })

  it("say records are records and what the Min-Max count is out of", () => {
    const html = page(management(kpis))
    expect(html).toContain("OAR recommendations")
    expect(html).toContain("1,200")
    expect(html).toContain("recommendation records")
    expect(html).toContain("of 21,343 recommendations generated in the period")
    expect(html).toContain("of 40 OAR material-plants")
    expect(html).toContain("Records for OAR material-plants, not materials")
  })

  it("make only the Min-Max card clickable, and tell the reader so", () => {
    const html = page(management(kpis))
    expect(html.match(/role="button"/g)?.length).toBe(1)
    expect(html).toContain("Min-Max conversion: show the materials")
    expect(html).toContain("Click to see the materials")
  })

  it("do not offer a click on a Min-Max card that has no figure", () => {
    const html = page(management([card("min_max_conversion", { value: null, status: "NOT_AVAILABLE" })]))
    expect(html).not.toContain("Click to see the materials")
  })

  it("keep the dialog closed, and its list unfetched, until the card is clicked", () => {
    expect(page(management(kpis))).not.toContain("Eligible for Min-Max conversion")
    expect(dialogSource).toContain("{open && <EligibleList")
    expect(viewSource).toContain("useState(false)")
  })
})

describe("the list behind the Min-Max card", () => {
  it("is the Recommendations list asked for the same thing the card counted: OAR, eligible, this period", () => {
    expect(dialogSource).toContain('type: "oar"')
    expect(dialogSource).toContain('conversionEligibility: "ELIGIBLE"')
    expect(dialogSource).toContain("generatedFrom,")
    expect(dialogSource).toContain("generatedTo,")
    expect(viewSource).toContain("generatedTo={`${dayAfter(report.metadata.period_end)}T00:00:00`}") // the period, half-open
  })

  it("pages the list and says how many material-plants it holds", () => {
    expect(dialogSource).toContain("TablePagination")
    expect(dialogSource).toContain("material-plant")
    expect(dialogSource).toContain("not a change made in SAP") // said in the dialog's own words
  })
})

describe("the PDF", () => {
  const rec = (id: string): Recommendation =>
    ({
      id,
      material: { materialId: id, description: `Material ${id}` },
      plantId: "1300",
      criticality: "High",
      demandPattern: "Lumpy",
      status: "Pending Review",
      generatedAt: "31 Oct 2026",
      current: { rop: 2, safetyStock: 1, maxStock: 10 },
      recommended: { rop: 12, safetyStock: 3, maxStock: 8 },
    }) as unknown as Recommendation
  const pdf = (m: ApiQuarterManagement, conversion: Recommendation[], total = 7) =>
    renderToStaticMarkup(
      createElement(ManagementPrintView, {
        report: report(m),
        management: m,
        materials: [],
        materialsTotal: 0,
        conversion,
        conversionTotal: total,
      }),
    )

  it("prints the materials the card counted, since a PDF cannot be clicked", () => {
    const out = pdf(management([card("min_max_conversion")]), [rec("A"), rec("B")])
    expect(out).toContain("Min-Max Conversion")
    expect(out).toContain("2 of 7 eligible material-plants")
    expect(out).toContain("Material A")
    expect(out).toContain("not a change made in SAP")
  })

  it("says none are eligible rather than printing an empty table, and leaves the section out of a report without the card", () => {
    expect(pdf(management([card("min_max_conversion")]), [])).toContain("No OAR material-plant from this period is eligible")
    expect(pdf(management([]), [rec("A")])).not.toContain("Min-Max Conversion")
  })

  it("fetches those rows with the same query as the click-through, and waits for them before printing", () => {
    expect(workspace).toContain('conversionEligibility: "ELIGIBLE"')
    expect(workspace).toContain("conversion={pdfConversion ?? []}")
    expect(workspace).toContain("pdfConversionLoading")
  })
})
