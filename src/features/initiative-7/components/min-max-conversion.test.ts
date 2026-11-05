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
    expect(html).toContain("of 21,343 recommendations created")
    expect(html).toContain("of 40 OAR materials that can move")
    expect(html).toContain("Eligible OAR recommendations in this period")
  })

  it("make only the Min-Max card clickable, and tell the reader so", () => {
    const html = page(management(kpis))
    expect(html.match(/role="button"/g)?.length).toBe(1)
    expect(html).toContain("Min-Max conversion: show the materials")
    expect(html).toContain("Click to see the materials")
  })

  it("say Not yet measured, never 0, when SAP has no change evidence, and still offer the list of eligible material-plants", () => {
    const html = page(
      management([
        card("min_max_conversion", {
          value: null,
          status: "UNKNOWN",
          unavailable_reason: "Not yet measured: no SAP change evidence.",
          denominator: 21,
          denominator_label: "eligible to convert",
        }),
      ]),
    )
    expect(html).toContain("Not yet measured")
    expect(html).toContain("Not yet measured: no SAP change evidence.")
    expect(html).toContain("of 21 OAR materials that can move")
    expect(html).toContain("Click to see the materials")
  })

  it("show the converted count when SAP has evidence, out of those eligible", () => {
    const html = page(management([card("min_max_conversion", { value: "3", denominator: 21, denominator_label: "eligible to convert" })]))
    expect(html).toContain("OAR materials moved to Min-Max in SAP")
    expect(html).toContain("of 21 OAR materials that can move")
  })

  it("do not offer a click when no material-plant is eligible at all", () => {
    const html = page(management([card("min_max_conversion", { value: null, status: "UNKNOWN", denominator: 0 })]))
    expect(html).not.toContain("Click to see the materials")
    expect(html.match(/role="button"/g)).toBeNull()
  })

  it("keep the dialog closed, and its list unfetched, until the card is clicked", () => {
    expect(page(management(kpis))).not.toContain("converted to Min-Max ordering in SAP")
    expect(dialogSource).toContain("{open && <Body")
    expect(viewSource).toContain("useState(false)")
  })
})

describe("the list behind the Min-Max card", () => {
  it("opens on the converted material-plants and can show every eligible one", () => {
    expect(dialogSource).toContain('useState<View>("converted")')
    expect(dialogSource).toContain('converted: "Moved in SAP"')
    expect(dialogSource).toContain('eligible: "Can move"')
    expect(dialogSource).toContain('adoptedInSap: view === "converted" ? true : undefined')
  })

  it("is the Recommendations list asked for the same thing the card counted: OAR, eligible, this period", () => {
    expect(dialogSource).toContain('type: "oar"')
    expect(dialogSource).toContain('conversionEligibility: "ELIGIBLE"')
    expect(dialogSource).toContain("generatedFrom,")
    expect(dialogSource).toContain("generatedTo,")
    expect(viewSource).toContain("generatedTo={`${dayAfter(report.metadata.period_end)}T00:00:00`}") // the period, half-open
  })

  it("pages the list, says how many it holds and what to do when none is converted", () => {
    expect(dialogSource).toContain("TablePagination")
    expect(dialogSource).toContain("material-plant")
    expect(dialogSource).toContain("None of this period's OAR materials that can move has moved to Min-Max in SAP yet")
    expect(dialogSource).toContain("Approval alone is not a move")
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
      status: "Implemented",
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

  it("prints the converted material-plants the card counted, since a PDF cannot be clicked", () => {
    const out = pdf(management([card("min_max_conversion", { value: "7", denominator: 21 })]), [rec("A"), rec("B")])
    expect(out).toContain("Min-Max Conversion")
    expect(out).toContain("7 converted in SAP, of 21 eligible to convert")
    expect(out).toContain("2 of 7 converted material-plants")
    expect(out).toContain("Material A")
    expect(out).toContain("approval alone is not conversion")
  })

  it("says Not yet measured when SAP has no evidence, rather than printing a 0", () => {
    const out = pdf(
      management([
        card("min_max_conversion", { value: null, status: "UNKNOWN", unavailable_reason: "No SAP change evidence.", denominator: 21 }),
      ]),
      [],
    )
    expect(out).toContain("Not yet measured")
    expect(out).toContain("21 are eligible to convert")
    expect(out).toContain("No OAR material-plant from this period has been converted in SAP.")
  })

  it("leaves the section out of a report without the card", () => {
    expect(pdf(management([]), [rec("A")])).not.toContain("Min-Max Conversion")
  })

  it("fetches those rows with the same query as the click-through (the converted ones), and waits for them before printing", () => {
    expect(workspace).toContain('conversionEligibility: "ELIGIBLE"')
    expect(workspace).toContain("adoptedInSap: true")
    expect(workspace).toContain("conversion={pdfConversion ?? []}")
    expect(workspace).toContain("pdfConversionLoading")
  })
})

describe("the Min-Max list counts the same materials as the card", () => {
  it("lists only OAR material-plants that have a recommended value, like the card's count", () => {
    // 21 are eligible by the rule but only the ones with a calculated value can move; the card and the list use the same filter.
    expect(dialogSource).toContain("hasRecommended: true")
    expect(workspace).toContain("hasRecommended: true")
    expect(workspace).toMatch(/conversionEligibility: "ELIGIBLE",\s+hasRecommended: true,\s+adoptedInSap: true/)
  })

  it("shows a dash for a recommended value the system does not have, never a 0", () => {
    expect(dialogSource).toContain('stockFigure(rec, "recommended", "safetyStock")')
    expect(dialogSource).toContain('stockFigure(rec, "recommended", "rop")')
    expect(dialogSource).toContain('stockFigure(rec, "recommended", "maxStock")')
    expect(dialogSource).not.toContain("formatCount(rec.recommended.")
    expect(dialogSource).toContain("never a 0 that nothing set")
  })

  it("keeps a space between the period and the words after it in the heading", () => {
    expect(dialogSource).toContain("from {periodLabel} that have moved")
  })

  it("reads a missing figure as missing and a real zero as zero", async () => {
    const { stockFigure } = await import("@/features/initiative-7/utils/stock-figure")
    const rec = {
      recommended: { rop: 0, safetyStock: 0, maxStock: 10 },
      current: { rop: 0, safetyStock: 0, maxStock: 0 },
      present: {
        recommended: { rop: false, safetyStock: true, maxStock: true },
        current: { rop: true, safetyStock: true, maxStock: true },
      },
    } as unknown as Recommendation
    expect(stockFigure(rec, "recommended", "rop")).toBeNull() // no value was worked out
    expect(stockFigure(rec, "recommended", "safetyStock")).toBe(0) // a recommended 0 is a real 0
    expect(stockFigure(rec, "recommended", "maxStock")).toBe(10)
    expect(stockFigure({ ...rec, present: undefined } as Recommendation, "recommended", "rop")).toBe(0) // an older mapper
  })

  it("prints a dash for a missing value in the PDF list too", () => {
    const row = {
      id: "A",
      material: { materialId: "A", description: "Material A" },
      plantId: "1300",
      criticality: "High",
      demandPattern: "Lumpy",
      status: "Pending Review",
      generatedAt: "31 Oct 2026",
      current: { rop: 0, safetyStock: 0, maxStock: 0 },
      recommended: { rop: 0, safetyStock: 0, maxStock: 0 },
      present: {
        recommended: { rop: false, safetyStock: false, maxStock: false },
        current: { rop: true, safetyStock: true, maxStock: true },
      },
    } as unknown as Recommendation
    const m = management([card("min_max_conversion", { value: "0", denominator: 4, denominator_label: "eligible to convert" })])
    const out = renderToStaticMarkup(
      createElement(ManagementPrintView, {
        report: report(m),
        management: m,
        materials: [],
        materialsTotal: 0,
        conversion: [row],
        conversionTotal: 4,
      }),
    )
    expect(out).toContain("Material A")
    expect(out).toContain(">—<") // each missing recommended value is a dash
    expect(out).not.toMatch(/print-mono">0</) // not a 0
  })
})
