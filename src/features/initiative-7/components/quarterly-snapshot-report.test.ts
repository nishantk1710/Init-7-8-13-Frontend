// The Q2 2026 Quarterly Report: what it shows, what it leaves out, and that it is wired into the page the same
// way as a generated report. The component is read from its source (as no-leakage.test.ts and
// action-center-decides.test.ts do), and the print view -- the PDF -- is rendered from the real snapshot.

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
    expect(workspace).toContain("withSnapshotQuarters(")
    expect(workspace).toContain("<QuarterlySnapshotReport")
  })

  it("does not ask the backend for a generated report for it", () => {
    expect(workspace).toContain('useQuarterlyReport(tab === "report" && !isSnapshot ?')
    expect(workspace).toContain('{tab === "report" && !isSnapshot && (')
  })
})

describe("it has the same controls as a generated report", () => {
  it("has a way back, Refresh and Download PDF", () => {
    expect(report).toContain("← All quarters")
    expect(report).toContain("Refresh")
    expect(report).toContain("Download PDF")
    expect(report).toContain("window.print()")
  })

  it("keeps the detail CSV the report was built with", () => {
    expect(report).toContain("Download detail (CSV)")
  })
})

describe("what it leaves out", () => {
  it("has no circuit exposure chart and no criticality tier cards", () => {
    expect(report).not.toMatch(/Critical circuit exposure/i)
    expect(report).not.toMatch(/Material criticality/i)
  })

  it("uses theme colours, not hex", () => {
    expect(report).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})

describe("the charts are clickable", () => {
  it("clicking a risk level filters the materials", () => {
    expect(report).toContain("onSelect={(level) => selectFromChart({ risk: toggled(filter.risk, level) })}")
  })

  it("clicking a status filters the materials, but a status with none is not selectable", () => {
    expect(report).toContain("onSliceClick={(label) => {")
    expect(report).toContain("if (!slice || slice.count === 0) return")
    expect(report).toContain("selectFromChart({ status: toggled(filter.status, label) })")
  })

  it("shows the active chart filter and lets it be cleared", () => {
    expect(report).toContain("<FilterChip")
    expect(report).toContain("Clear chart filters")
  })
})

describe("the PDF", () => {
  async function pdf(): Promise<string> {
    const snapshot = await loadQuarterlySnapshot()
    return renderToStaticMarkup(createElement(QuarterlySnapshotPrintView, { snapshot }))
  }

  it("shows Pending Review as counted and every other status as 0", async () => {
    const html = await pdf()
    const status = html.slice(html.indexOf("Recommendation Status"), html.indexOf("Current SAP vs I07"))
    expect(status).toContain("Pending Review")
    expect(status).toContain("858")
    for (const name of ["Approved", "Implemented", "Returned", "Rejected"]) {
      expect(status).toMatch(new RegExp(`${name}</td><td>0</td>`))
    }
  })

  it("shows SAP adoption as 0", async () => {
    const html = await pdf()
    const adoption = html.slice(html.indexOf("SAP Adoption"), html.indexOf("Where These Numbers Come From"))
    for (const name of ["Adopted", "Partial", "Not adopted"]) {
      expect(adoption).toMatch(new RegExp(`${name}</td><td>0</td>`))
    }
  })

  it("has no circuit exposure and no criticality tier section", async () => {
    const html = await pdf()
    expect(html).not.toMatch(/circuit exposure/i)
    expect(html).not.toMatch(/Material Criticality/i)
  })

  it("says the material table is a subset and points at the CSV", async () => {
    const html = await pdf()
    expect(html).toContain("This is a subset")
    expect(html).toContain("CSV download")
  })
})
