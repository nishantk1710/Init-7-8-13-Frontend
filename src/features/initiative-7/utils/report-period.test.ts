import { describe, expect, it } from "vitest"

import { SNAPSHOT_QUARTER } from "@/features/initiative-7/utils/quarterly-snapshot"
import { REPORT_KINDS, landingReports, reportKindOf, reportNoun } from "./report-period"

describe("which kind of report a label is", () => {
  it("calls Q<n> <year> a quarter and a month name a month", () => {
    expect(reportKindOf("Q4 2026")).toBe("quarterly")
    expect(reportKindOf("Q1 2027")).toBe("quarterly")
    expect(reportKindOf("Oct 2026")).toBe("monthly")
    expect(reportKindOf("Dec 2026")).toBe("monthly")
  })

  it("offers the two toggles, Monthly then Quarterly", () => {
    expect(REPORT_KINDS.map((k) => k.label)).toEqual(["Monthly", "Quarterly"])
  })
})

describe("the reports each toggle lists", () => {
  const generated = ["Q1 2026", "Oct 2026", "Sep 2026", "Q4 2025", "Dec 2025", "Q3 2026", "Q4 2026"]

  it("lists the months that were generated, newest first, with no quarter among them", () => {
    expect(landingReports("monthly", generated)).toEqual(["Oct 2026", "Sep 2026", "Dec 2025"])
  })

  it("sorts months across a year boundary by date, not by name", () => {
    expect(landingReports("monthly", ["Dec 2025", "Jan 2026", "Feb 2026", "Nov 2025"])).toEqual([
      "Feb 2026", "Jan 2026", "Dec 2025", "Nov 2025",
    ])
  })

  it("lists each month once", () => {
    expect(landingReports("monthly", ["Oct 2026", "Oct 2026"])).toEqual(["Oct 2026"])
  })

  it("lists no months until one is generated -- there is no month snapshot to offer in their place", () => {
    expect(landingReports("monthly", ["Q1 2026"])).toEqual([])
  })

  it("lists every generated quarter, newest first, with the Q2 snapshot always offered and no month among them", () => {
    const quarters = landingReports("quarterly", generated)
    expect(quarters).toEqual(["Q4 2026", "Q3 2026", "Q2 2026", "Q1 2026", "Q4 2025"])
    expect(quarters).toContain(SNAPSHOT_QUARTER)
    expect(quarters.some((label) => reportKindOf(label) === "monthly")).toBe(false)
  })

  it("shows only the Q2 snapshot when no quarter has been generated", () => {
    expect(landingReports("quarterly", [])).toEqual([SNAPSHOT_QUARTER])
  })
})

describe("the words for each kind", () => {
  it("says month or quarter, and what the closing position and the total are called", () => {
    expect(reportNoun("monthly")).toEqual({ singular: "month", endPosition: "Month-end position", total: "Month total" })
    expect(reportNoun("quarterly")).toEqual({ singular: "quarter", endPosition: "Quarter-end position", total: "Quarter total" })
  })
})
