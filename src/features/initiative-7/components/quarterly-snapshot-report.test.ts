// The Q2 2026 Quarterly Report: that it is the Overview's figures as a report, what it leaves out, and that it is
// wired into the page the same way as a generated report. The component is read from its source (as
// no-leakage.test.ts and action-center-decides.test.ts do), and the print view -- the PDF -- is rendered from the
// real snapshot.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { QuarterlySnapshotPrintView } from "@/features/initiative-7/components/quarterly-snapshot-print-view"
import { loadQuarterlySnapshot } from "@/features/initiative-7/utils/quarterly-snapshot"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const FEATURE = "src/features/initiative-7"
const report = read(`${FEATURE}/components/quarterly-snapshot-report.tsx`)
const workspace = read(`${FEATURE}/components/quarterly-reports-workspace.tsx`)

describe("the Q2 report is opened like any other quarter", () => {
  it("is offered on the landing grid and opens its own view", () => {
    expect(workspace).toContain("landingReports(") // the landing list, which keeps the snapshot among the quarters
    expect(readFileSync(join(process.cwd(), "src/features/initiative-7/utils/report-period.ts"), "utf8")).toContain("landingQuarters(")
    expect(workspace).toContain("<QuarterlySnapshotReport")
  })

  it("does not ask the backend for a generated report for it", () => {
    expect(workspace).toContain('useQuarterlyReport(tab === "report" && !isSnapshot ?')
    expect(workspace).toContain('{tab === "report" && !isSnapshot && (')
  })
})

describe("it has the same controls as a generated report", () => {
  it("has a way back, Refresh and Download PDF", () => {
    expect(report).toContain("← All reports")
    expect(report).toContain("Refresh")
    expect(report).toContain("Download PDF")
    expect(report).toContain("window.print()")
  })
})

describe("it is the Overview, as a report", () => {
  it("draws the Overview's own KPI row and widgets, not a copy of them", () => {
    expect(report).toContain("<InventoryPortfolioKpis")
    expect(report).toContain("<StockoutRiskDistribution")
    expect(report).toContain("<StockoutPositionCard")
    expect(report).toContain("<ExcessPositionCard")
    expect(report).toContain("<AdoptionRateCard")
  })

  it("has the Overview's Plant and Recommendation choices", () => {
    expect(report).toContain('aria-label="Plant"')
    expect(report).toContain('aria-label="Recommendation"')
  })

  it("has the Adopted recommendation card, not Pending approval", () => {
    expect(report).toContain("adoptedOverride")
    expect(report).not.toMatch(/Pending approval/i)
  })
})

describe("what it leaves out, because the Overview does not have it", () => {
  it("has no Recommendation status, Forecast vs Actual, stockout trend or source activity", () => {
    expect(report).not.toMatch(/Recommendation status/i)
    expect(report).not.toMatch(/Forecast vs Actual/i)
    expect(report).not.toMatch(/Stockout risk trend/i)
    expect(report).not.toMatch(/Source activity/i)
  })

  it("has no circuit exposure chart and no criticality tier cards", () => {
    expect(report).not.toMatch(/Critical circuit exposure/i)
    expect(report).not.toMatch(/Material criticality/i)
  })

  it("has no CSV download of the old detail", () => {
    expect(report).not.toContain("Download detail (CSV)")
  })

  it("uses theme colours, not hex", () => {
    expect(report).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})

describe("the PDF", () => {
  async function pdf(): Promise<string> {
    const snapshot = await loadQuarterlySnapshot()
    return renderToStaticMarkup(createElement(QuarterlySnapshotPrintView, { snapshot }))
  }

  it("carries the Overview's four figures and says where they are from", async () => {
    const html = await pdf()
    expect(html).toContain("High stockout risk")
    expect(html).toContain("Excess inventory candidates")
    expect(html).toContain("Working capital impact")
    expect(html).toContain("Adopted recommendation")
    expect(html).toContain("October 2026 run")
  })

  it("has the same stockout and excess figures as the data, for All plants", async () => {
    const data = await loadQuarterlySnapshot()
    const all = data.scopes.find((s) => s.plant === null && s.type === "all")!.figures
    const html = await pdf()
    expect(html).toContain(all.stockout_at_risk.toLocaleString("en-US"))
    expect(html).toContain(all.excess_count.toLocaleString("en-US"))
  })

  it("says Not available for a figure that was not captured, never 0", async () => {
    const html = await pdf()
    const data = await loadQuarterlySnapshot()
    const all = data.scopes.find((s) => s.plant === null && s.type === "all")!.figures
    if (all.net_rop_value_impact === null) expect(html).toContain("Not available")
  })

  it("has none of the sections the Overview does not", async () => {
    const html = await pdf()
    expect(html).not.toMatch(/Recommendation Status/i)
    expect(html).not.toMatch(/Forecast vs Actual/i)
    expect(html).not.toMatch(/Stockout Risk Trend/i)
    expect(html).not.toMatch(/circuit exposure/i)
    expect(html).not.toMatch(/Material Criticality/i)
  })
})
