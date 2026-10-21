// The overview's Download PDF: what the PDF says about the slice it shows, and
// that its print stylesheet cannot leak onto another screen's PDF. The
// stylesheet and the dashboard are read from source, as the I07 quarterly
// report test reads its component.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { OverviewPrintDocument } from "@/features/initiative-8/components/overview-print"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const COMPONENTS = "src/features/initiative-8/components"
// The rules only: the stylesheet's comments quote the I07 rules it guards against.
const css = read(`${COMPONENTS}/overview-print.css`).replace(/\/\*[\s\S]*?\*\//g, "")
const dashboard = read(`${COMPONENTS}/overview-dashboard.tsx`)

describe("the PDF names the slice its figures came from", () => {
  const html = renderToStaticMarkup(
    createElement(
      OverviewPrintDocument,
      {
        title: "Repairable Spares — Overview",
        caption: "Repair register for 80-series spares. As at 2026-10-21.",
        filters: { plant: "Gamsberg", vendor: "All vendors", criticality: "A" },
        lines: "412 of 818 repair lines",
        note: "Vendor narrows the repair-line figures only.",
        printedAt: "21 Oct 2026, 12:45",
      },
      createElement("p", null, "the figures"),
    ),
  )

  it("says which plant, vendor and criticality it is about", () => {
    expect(html).toContain("Plant: Gamsberg")
    expect(html).toContain("Vendor: All vendors")
    expect(html).toContain("Criticality: A")
    expect(html).toContain("412 of 818 repair lines")
  })

  it("carries the as-at caption, what each filter narrows, and when it was printed", () => {
    expect(html).toContain("As at 2026-10-21.")
    expect(html).toContain("Vendor narrows the repair-line figures only.")
    expect(html).toContain("Printed 21 Oct 2026, 12:45")
    expect(html).toContain("the figures")
  })
})

describe("the print stylesheet stays on this screen", () => {
  it("hides the rest of the page only while this copy is mounted", () => {
    expect(css).toContain("body:has(> .i08-overview-print) > *:not(.i08-overview-print)")
    // The I07 stylesheet's unscoped form, which would blank later PDFs.
    expect(css).not.toMatch(/^\s*body > \* \{/m)
  })

  it("sets its page size on a named page, not on every page", () => {
    expect(css).not.toMatch(/@page\s*\{/)
    expect(css).toContain("page: i08-overview;")
  })

  it("stays landscape when another screen's portrait @page loaded after it", () => {
    // Without !important, Chrome let I07's unnamed portrait rule win.
    expect(css).toMatch(/@page i08-overview \{\s*size: A4 landscape !important;/)
  })
})

describe("the dashboard prints rather than exporting a spreadsheet", () => {
  it("offers Download PDF and opens the print dialog", () => {
    expect(dashboard).toContain("Download PDF")
    expect(dashboard).toContain("window.print()")
    expect(dashboard).toContain("<OverviewFigures {...figures} print />")
  })

  it("has no Excel export left", () => {
    expect(dashboard).not.toContain("downloadExcel")
    expect(dashboard).not.toContain("Export summary")
  })
})
