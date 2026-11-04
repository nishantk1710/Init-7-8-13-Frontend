// The report page in plain words, with the detail folded away: short lines first, the explanation one click behind them. Numbers,
// calculations and the PDF and Excel are untouched -- the PDF keeps the report's own titles and labels.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ManagementPrintView } from "@/features/initiative-7/components/quarterly-management-print"
import { QuarterlyManagementView } from "@/features/initiative-7/components/quarterly-management-view"
import { CoverageStatusTable } from "@/features/initiative-7/components/monthly-report-sections"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import { pageCardTitle, pageDenominatorLabel, cardTitle } from "@/features/initiative-7/utils/quarterly-management"
import { PERSPECTIVE_LABEL } from "@/features/initiative-7/utils/quarterly-sections"

const card = (key: string, over: Partial<ApiKpiCard> = {}): ApiKpiCard => ({
  key,
  title: `Backend title ${key}`,
  unit: "units",
  value: "10",
  status: "AVAILABLE",
  explanation: `Long explanation of ${key}.`,
  kind: "EVENT",
  measured_on: null,
  period_label: "Oct 2026",
  denominator: null,
  denominator_label: null,
  basis: "current_calculation",
  unavailable_reason: null,
  note: null,
  ...over,
})

const staleStockout = {
  at_risk: 0,
  evaluated: 0,
  insufficient_data: 0,
  as_of: "2026-07-30",
  stale: true,
  stale_note: "Stockout risk was last measured on 30 Jul 2026, 93 days before this report's cutoff.",
}
const goodStockout = { at_risk: 5, evaluated: 50, insufficient_data: 1, as_of: "2026-10-30", stale: false, stale_note: null }
const figures = (stockout: object) => ({
  population: 1,
  stockout,
  excess_count: 0,
  excess_opportunity: null,
  net_rop_value_impact: null,
  priced_count: 0,
  currency: null,
})

const item = (key: string, status: string, detail: string | null = null) => ({
  key,
  label: `Source ${key}`,
  value: "30 Jul 2026",
  status,
  detail,
})

function management(over: Record<string, unknown> = {}, stockout: object = staleStockout): ApiQuarterManagement {
  return {
    period: { status: "COMPLETE", cutoff: "2026-10-31", months: [], note: "Oct 2026 is complete." },
    monthly_activity: {
      months: [{ month: "2026-10-01", label: "Oct 2026", state: "ended", has_consumption_data: true, usable: true }],
      rows: [
        {
          key: "x",
          label: "Row x",
          unit: "records",
          kind: "EVENT",
          months: [1],
          quarter_total: 1,
          status: "AVAILABLE",
          reconciles: true,
          note: "Row note that explains how it is counted.",
        },
      ],
    },
    kpis: [
      card("critical_stockout_risk", {
        value: null,
        status: "NOT_AVAILABLE",
        unavailable_reason: "Stockout risk was last measured on 30 Jul 2026, far too long ago.",
      }),
      card("materials_assessed", { denominator: 18700, denominator_label: "distinct material-plants looked at" }),
    ],
    position: figures(stockout),
    plant_positions: [{ plant: null, figures: figures(stockout) }],
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
    adoption: {
      status: "UNKNOWN",
      confirmed_adoptions: null,
      pending_approvals: 0,
      reason: "r",
      stages: {
        total: 3,
        not_submitted: 1,
        awaiting_approval: 1,
        adjusted_in_chain: 0,
        approved_awaiting_sap: 1,
        implemented_in_sap: 0,
        rejected_or_sent_back: 0,
        other: 0,
      },
    },
    data_coverage: {
      latest_consumption_date: null,
      latest_consumption_month: null,
      latest_stock_loaded_at: null,
      stockout_usage_as_of: null,
      months: [],
      eligible_recommendations: 1,
      eligible_material_plants: 1,
      basis: "current_calculation",
      warnings: ["A coverage warning."],
      items: [
        item("stockout", "Stale", "Last measured 30 Jul 2026."),
        item("currency", "Available"),
        item("forecast", "Not available", "No forecast."),
      ],
    },
    definitions: ["A definition of a kind of figure."],
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

const page = (m: ApiQuarterManagement) => renderToStaticMarkup(createElement(QuarterlyManagementView, { report: report(m), management: m }))
const outsideFolded = (html: string) => html.replace(/<details[\s\S]*?<\/details>/g, "")

describe("Data coverage", () => {
  it("lists only the sources that need attention by default, and everything behind Show all", () => {
    const html = page(management())
    expect(html).toContain("Show all")
    const visible = outsideFolded(html)
    expect(visible).toContain("Source stockout") // Stale
    expect(visible).toContain("Source forecast") // Not available
    expect(visible).not.toContain("Source currency") // Available: not shown until asked for
    expect(html).toContain("Source currency") // ... but still on the page, behind Show all
  })

  it("keeps the warnings and definitions reachable, folded away", () => {
    const html = page(management())
    expect(outsideFolded(html)).not.toContain("A coverage warning.")
    expect(html).toContain("A coverage warning.")
    expect(html).toContain("A definition of a kind of figure.")
  })

  it("says so when everything is up to date, instead of an empty table", () => {
    const allGood = management({
      data_coverage: { ...management().data_coverage, items: [item("a", "Available"), item("b", "Available")] },
    })
    expect(outsideFolded(page(allGood))).toContain("Everything this report uses is up to date.")
  })

  it("lists every item when asked for them all", () => {
    const html = renderToStaticMarkup(createElement(CoverageStatusTable, { management: management() }))
    for (const key of ["stockout", "currency", "forecast"]) expect(html).toContain(`Source ${key}`)
  })
})

describe("the stockout charts with nothing to draw", () => {
  it("say it in one short line, with the last data date, and keep the full reason behind Why?", () => {
    const html = page(management())
    const visible = outsideFolded(html)
    expect(visible).toContain("Not measured for Oct 2026. Last data: 30 Jul 2026.")
    expect(visible).not.toContain("93 days before this report")
    expect(html).toContain("Why?")
    expect(html).toContain("93 days before this report") // the full reason is still there, one click away
    expect(html).toContain("This is not zero risk")
  })

  it("draw the figures, with no Why?, when the reading is current", () => {
    const m = management({ kpis: [] }, goodStockout)
    expect(page(m)).not.toContain("Not measured for Oct 2026")
  })
})

describe("the longer notes", () => {
  it("fold the activity notes behind How these are counted", () => {
    const html = page(management())
    expect(html).toContain("How these are counted")
    expect(outsideFolded(html)).not.toContain("Row note that explains how it is counted.")
    expect(html).toContain("Row note that explains how it is counted.")
  })

  it("fold the card's technical reason behind Why is this not shown?", () => {
    const html = page(management())
    expect(outsideFolded(html)).not.toContain("far too long ago")
    expect(html).toContain("Why is this not shown?")
    expect(html).toContain("far too long ago")
  })

  it("fold the approval-stage explanation behind What do these mean?", () => {
    const html = page(management())
    expect(html).toContain("What do these mean?")
    expect(outsideFolded(html)).not.toContain("Approved is not the same as changed in SAP")
  })

  it("keep each section to one short line under its title", () => {
    const visible = outsideFolded(page(management()))
    expect(visible).toContain("What happened each month.")
    expect(visible).not.toContain("Decisions come from the dated approval history, not from a recommendation")
    expect(visible).not.toContain("Fast and slow moving material-plants")
  })
})

describe("plain words on the page, and the PDF left as it is", () => {
  it("says the page's card titles and counts in everyday words", () => {
    expect(pageCardTitle(card("materials_assessed"))).toBe("Materials with a recommendation")
    expect(pageDenominatorLabel(card("min_max_conversion", { denominator_label: "eligible to convert" }))).toBe(
      "OAR materials that can move",
    )
    expect(pageCardTitle(card("something_new"))).toBe("Backend title something_new") // a card with no entry keeps the report's own words
  })

  it("keeps the report's own title for the PDF", () => {
    expect(cardTitle(card("materials_assessed"))).toBe("Material-plants with a computed recommendation")
    const m = management()
    const pdf = renderToStaticMarkup(
      createElement(ManagementPrintView, { report: report(m), management: m, materials: [], materialsTotal: 0 }),
    )
    expect(pdf).toContain("Material-plants with a computed recommendation")
    expect(pdf).toContain("distinct material-plants looked at") // the PDF prints the report's own label, not the page's
  })

  it("names the three kinds of figure in everyday words, each with a hover explanation", () => {
    expect(Object.values(PERSPECTIVE_LABEL).map((p) => p.label)).toEqual(["This month's activity", "Saved at month end", "As of today"])
    for (const p of Object.values(PERSPECTIVE_LABEL)) expect(p.hint.length).toBeGreaterThan(20)
  })
})
