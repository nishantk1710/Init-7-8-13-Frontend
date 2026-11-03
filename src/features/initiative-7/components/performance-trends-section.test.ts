// The monthly performance trends: what each chart draws, and that a month with no figure is a gap -- never a zero.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PerformanceTrends } from "@/features/initiative-7/components/performance-trends-section"
import type { ApiPerformanceMonth, ApiPerformanceTrends } from "@/features/initiative-7/types/api"
import { MIN_EXCESS_POINTS, performancePoints, pointCount } from "@/features/initiative-7/utils/quarterly-sections"

const month = (label: string, over: Partial<ApiPerformanceMonth> = {}): ApiPerformanceMonth => ({
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

const trends = (months: ApiPerformanceMonth[], notes: string[] = ["SAP implementation has no monthly series."]): ApiPerformanceTrends => ({
  months,
  recommendation_history_from: null,
  approval_history_from: null,
  notes,
})

const render = (t: ApiPerformanceTrends) => renderToStaticMarkup(createElement(PerformanceTrends, { performance: t }))

describe("the points", () => {
  it("keep a month with no figure as null, and leave a rolling or missing snapshot out of the excess line", () => {
    const points = performancePoints(
      trends([
        month("Aug 2026", { excess_state: "MONTH_END", excess_opportunity: "500.00", records_generated: 0, material_plants_generated: 0 }),
        month("Sep 2026", { excess_state: "ROLLING", excess_opportunity: "900.00" }),
        month("Oct 2026"),
      ]),
    )
    expect(points.map((p) => p.excess)).toEqual([500, null, null])
    expect(points[0].records).toBe(0) // a real 0 stays 0 ...
    expect(points[2].records).toBeNull() // ... and no figure stays no figure
  })

  it("count how many months have a figure", () => {
    const points = performancePoints(trends([month("A", { approved: 0 }), month("B"), month("C", { rejected: 2 })]))
    expect(pointCount(points, ["approved", "rejected"])).toBe(2)
    expect(MIN_EXCESS_POINTS).toBe(2)
  })
})

describe("the section", () => {
  const full = trends([
    month("Aug 2026", {
      excess_state: "MONTH_END",
      excess_opportunity: "500.00",
      currency: "ZAR",
      records_generated: 4,
      material_plants_generated: 3,
      submitted: 1,
      approved: 1,
      rejected: 0,
      sent_back: 0,
    }),
    month("Sep 2026", {
      excess_state: "MONTH_END",
      excess_opportunity: "700.00",
      currency: "ZAR",
      records_generated: 6,
      material_plants_generated: 5,
      submitted: 2,
      approved: 1,
      rejected: 1,
      sent_back: 0,
    }),
    month("Oct 2026", { records_generated: 2, material_plants_generated: 2, submitted: 0, approved: 0, rejected: 0, sent_back: 0 }),
  ])

  it("has the three trends, each saying what kind of figure it is", () => {
    const html = render(full)
    for (const title of ["Monthly performance and trends", "Excess inventory trend", "Recommendations generated", "Approval activity"])
      expect(html).toContain(title)
    expect(html).toContain("Month-end snapshot") // the excess line is from saved snapshots
    expect(html).toContain("Monthly activity") // the other two are events in the month
    expect(html).toContain("distinct material-plants they cover") // records are never presented as distinct material-plants
    expect(html).toContain("No month-end snapshot for Oct 2026.") // the gap is named, not drawn as zero
  })

  it("lists each month's excess value in full under the chart, never abbreviated to millions", () => {
    const html = render(
      trends([
        month("Aug 2026", { excess_state: "MONTH_END", excess_opportunity: "12830000.00", currency: "ZAR" }),
        month("Sep 2026", { excess_state: "MONTH_END", excess_opportunity: "850000.00", currency: "ZAR" }),
        month("Oct 2026", { excess_state: "MONTH_END", excess_opportunity: "103950.00", currency: "ZAR" }),
      ]),
    )
    expect(html).toContain("ZAR 12,830,000")
    expect(html).toContain("ZAR 850,000")
    expect(html).toContain("ZAR 103,950")
    expect(html).not.toMatch(/\d\.\d+M/)
  })

  it("says there is no excess trend yet, rather than drawing one point or zeros", () => {
    const none = render(
      trends([
        month("Sep 2026", { records_generated: 1, material_plants_generated: 1 }),
        month("Oct 2026", { records_generated: 1, material_plants_generated: 1 }),
      ]),
    )
    expect(none).toContain("No month has a saved month-end snapshot yet")
    const one = render(trends([month("Sep 2026", { excess_state: "MONTH_END", excess_opportunity: "700.00" }), month("Oct 2026")]))
    expect(one).toContain("Only one month has a saved month-end snapshot")
  })

  it("shows an empty state when nothing was recorded, and never a zero for it", () => {
    const html = render(trends([month("Sep 2026"), month("Oct 2026")]))
    expect(html).toContain("No recommendation has been generated in these months.")
    expect(html).toContain("No approval event has been recorded in these months.")
  })

  it("says SAP implementation is not charted and why, and lists how the months were measured", () => {
    const html = render(full)
    expect(html).toContain("SAP implementation is not charted")
    expect(html).toContain("not as dated events")
    expect(html).toContain("How the trends are measured")
    expect(html).toContain("SAP implementation has no monthly series.")
  })
})
