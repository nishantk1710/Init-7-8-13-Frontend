// What the Criticality Reports page says, rendered to static markup (vitest
// runs in `node` with no DOM -- see vitest.config.mts).

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { UploadResultPanel } from "./criticality-upload-card"
import { HistoryBody } from "./criticality-history-card"
import type { CriticalityUpload, CriticalityUploadResult } from "@/features/initiative-7/types/criticality-reports"
import {
  filterUploads,
  formatMonth,
  previousMonth,
  thisMonth,
} from "@/features/initiative-7/utils/criticality-reports"

function upload(overrides: Partial<CriticalityUpload> = {}): CriticalityUpload {
  return {
    id: 1,
    plant: "1300",
    reportMonth: "2026-08-01",
    fileName: "BMM-ZMM065_Aug 26.xlsx",
    source: "upload",
    uploadedBy: "nishant",
    uploadedAt: "2026-09-02T08:15:00Z",
    rowCount: 10521,
    status: "current",
    ...overrides,
  }
}

function result(overrides: Partial<CriticalityUploadResult> = {}): CriticalityUploadResult {
  return {
    upload: upload(),
    rowsRead: 10521,
    tiers: 5,
    duplicates: 0,
    blankTiers: 12,
    skippedBlankMaterial: 0,
    filePlant: "1300",
    isCurrent: true,
    currentMonth: "2026-08-01",
    replacedUploadId: null,
    fileStored: true,
    ...overrides,
  }
}

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'")

describe("the result panel", () => {
  it("says which month is now current, for which plant, with the counts", () => {
    const html = renderToStaticMarkup(createElement(UploadResultPanel, { result: result() }))
    const said = text(html)
    expect(said).toContain("Uploaded — Aug 2026 is now the current report for Black Mountain (1300)")
    for (const chip of ["10,521 rows read", "5 tiers", "0 duplicates", "12 blank tiers", "File plant 1300 ✓ matches"]) {
      expect(said).toContain(chip)
    }
    // Blank tiers are amber when there are any.
    expect(html).toMatch(/text-warning[^>]*>12 blank tiers/)
  })

  it("does not claim a back-dated month became current", () => {
    const said = text(
      renderToStaticMarkup(
        createElement(UploadResultPanel, {
          result: result({ upload: upload({ reportMonth: "2026-06-01" }), isCurrent: false }),
        })
      )
    )
    expect(said).toContain("Jun 2026 is kept for Black Mountain (1300)")
    expect(said).toContain("Aug 2026 stays current")
    expect(said).not.toContain("is now the current report")
  })

  it("mentions a replaced upload, and that it is kept", () => {
    const said = text(renderToStaticMarkup(createElement(UploadResultPanel, { result: result({ replacedUploadId: 3 }) })))
    expect(said).toContain("Replaced the earlier Aug 2026 upload for this plant; it stays in the history.")
  })
})

describe("the history", () => {
  const uploads = [
    upload({ id: 4, status: "current", fileName: "aug-v2.xlsx" }),
    upload({ id: 3, status: "replaced", fileName: "aug.xlsx" }),
    upload({ id: 2, plant: "1500", reportMonth: "2026-07-01", status: "current", source: "july_delivery", fileName: "(July delivery)", uploadedBy: null }),
    upload({ id: 1, reportMonth: "2026-07-01", status: "previous", source: "july_delivery", fileName: "(July delivery)", uploadedBy: null }),
  ]

  function render(plant: string | null, rows: CriticalityUpload[] | null = uploads) {
    return text(renderToStaticMarkup(createElement(HistoryBody, { uploads: rows, plant, loading: false, error: null })))
  }

  it("shows every upload with its status and the count", () => {
    const said = render(null)
    expect(said).toContain("aug-v2.xlsx")
    expect(said).toContain("Gamsberg (1500)")
    expect(said).toContain("Current")
    expect(said).toContain("Replaced")
    expect(said).toContain("Previous")
    expect(said).toContain("Showing 1–4 of 4 uploads")
  })

  it("pages a long history, 25 to a page, and shows the pager only then", () => {
    const many = Array.from({ length: 30 }, (_, i) => upload({ id: i + 1, fileName: `report-${i + 1}.xlsx` }))
    const html = renderToStaticMarkup(createElement(HistoryBody, { uploads: many, plant: null, loading: false, error: null }))
    const said = text(html)
    expect(said).toContain("Showing 1–25 of 30 uploads · Page 1 of 2")
    expect(said).toContain("report-25.xlsx")
    expect(said).not.toContain("report-26.xlsx")
    // A short history has nothing to turn to: the count line, no Previous/Next.
    expect(html).toContain(">Next</button>")
    expect(render(null)).not.toContain("Next")
  })

  it("shows the chart ring, not a blank, while the history loads", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryBody, { uploads: null, plant: null, loading: true, error: null })
    )
    expect(html).toContain("chart-loader-ring")
    expect(html).toContain('aria-label="Loading the upload history"')
  })

  it("shows the July delivery as such, with nobody as its uploader", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryBody, { uploads: [uploads[3]], plant: null, loading: false, error: null })
    )
    expect(text(html)).toContain("(July delivery)")
    expect(text(html)).toContain("—")
  })

  it("narrows to one plant", () => {
    const said = render("1500")
    expect(said).toContain("Showing 1–1 of 1 upload")
    expect(said).not.toContain("1 uploads")
    expect(said).not.toContain("aug-v2.xlsx")
  })

  it("shows a placeholder uploader as just Unauthorized, not the technical placeholder name", () => {
    for (const placeholder of ["UNAUTHENTICATED-FRONTEND", "UNAUTHENTICATED_LOCAL_USER", "unknown-actor"]) {
      const said = render(null, [upload({ uploadedBy: placeholder })])
      expect(said).toContain("Unauthorized")
      expect(said).not.toContain(placeholder)
      expect(said).not.toContain("provisional")
    }
  })

  it("still shows a real signed-in uploader by name", () => {
    const said = render(null, [upload({ uploadedBy: "khushi.patil" })])
    expect(said).toContain("khushi.patil")
    expect(said).not.toContain("Unauthorized")
  })

  it("says so when a plant has nothing yet, rather than showing an empty table", () => {
    expect(render("1500", [])).toContain("Nothing has been uploaded for Gamsberg (1500) yet.")
  })

  it("reports a load failure instead of an empty history", () => {
    const said = text(
      renderToStaticMarkup(createElement(HistoryBody, { uploads: null, plant: null, loading: false, error: "GET failed with 500" }))
    )
    expect(said).toContain("The upload history could not be loaded: GET failed with 500")
  })
})

describe("helpers", () => {
  it("formats months", () => {
    expect(formatMonth("2026-08-01")).toBe("Aug 2026")
    expect(formatMonth("2026-08")).toBe("Aug 2026")
    expect(formatMonth(null)).toBe("—")
  })

  it("defaults to last month and caps at this month", () => {
    const now = new Date(2026, 0, 15)
    expect(previousMonth(now)).toBe("2025-12")
    expect(thisMonth(now)).toBe("2026-01")
  })

  it("filters and counts", () => {
    const rows = [upload({ plant: "1300" }), upload({ id: 2, plant: "1500" })]
    expect(filterUploads(rows, null)).toHaveLength(2)
    expect(filterUploads(rows, "1500").map((u) => u.id)).toEqual([2])
  })
})
