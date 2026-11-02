// The monthly trends and quarter-end position of a quarterly report: what they show for a measured month, a missing one and
// an untrusted one, and that the quarter-end card never shows an earlier month as the quarter-end.
//
// Rendered to static markup (this project's vitest runs without a DOM); the charts themselves draw nothing there, so what
// is checked is the table, the notes and the card -- the words and numbers a reader acts on.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MonthlyTrends, QuarterEndCard } from "@/features/initiative-7/components/quarterly-trends-section"
import type { ApiQuarterEnd, ApiQuarterTrends, ApiTrendMonth } from "@/features/initiative-7/types/api"

function month(overrides: Partial<ApiTrendMonth> = {}): ApiTrendMonth {
  return {
    month: "2026-10-01", label: "Oct 2026", state: "FINAL", measured_on: "2026-11-03", month_end_valid: true, stockout_valid: true,
    population: 10, stockout_at_risk: 5, stockout_evaluated: 50, stockout_insufficient: 2, excess_count: 3,
    excess_opportunity: "1500000.00", net_rop_value_impact: "-2000000.00", net_rop_change_from_previous: null, currency: null,
    revision: 1, calc_version: "1", note: null, ...overrides,
  }
}

function end(overrides: Partial<ApiQuarterEnd> = {}): ApiQuarterEnd {
  return {
    status: "AVAILABLE", month: "2026-12-01", label: "Dec 2026", snapshot_state: "FINAL", measured_on: "2027-01-04", reason: null,
    population: 10,
    stock_levels: [{ key: "reorder_point", label: "Reorder point", aggregation: "mean", records: 1234, current: "10.0", recommended: "25.5" }],
    latest_available_month: null, latest_available_label: null, latest_available_measured_on: null, ...overrides,
  }
}

const trends = (months: ApiTrendMonth[], quarterEnd: ApiQuarterEnd = end(), notes: string[] = []): ApiQuarterTrends => ({
  months, quarter_end: quarterEnd, notes,
})

const trendHtml = (t: ApiQuarterTrends) => renderToStaticMarkup(createElement(MonthlyTrends, { trends: t }))
const endHtml = (t: ApiQuarterTrends) => renderToStaticMarkup(createElement(QuarterEndCard, { trends: t }))

describe("the monthly trends", () => {
  const gap = (overrides: Partial<ApiTrendMonth> = {}) =>
    month({ month: "2026-11-01", label: "Nov 2026", state: "MISSING", measured_on: null, stockout_at_risk: null, stockout_evaluated: null,
      excess_opportunity: null, net_rop_value_impact: null, note: "No snapshot was captured for this month, and a past month cannot be rebuilt.", ...overrides })

  it("draw one card for each measure, as the Overview lays out its charts, with no table", () => {
    const html = trendHtml(trends([month()]))
    for (const title of ["At stockout risk", "Excess inventory opportunity", "Working capital impact"]) expect(html).toContain(title)
    expect(html).not.toContain("<table")
  })

  it("give each card an (i) for the detail, rather than printing it on the card", () => {
    const html = trendHtml(trends([month()], end(), ["Realised savings are not measured."]))
    for (const title of ["At stockout risk", "Excess inventory opportunity", "Working capital impact"]) {
      expect(html).toContain(`How &quot;${title}&quot; is calculated`) // each card's own (i)
    }
    expect(html).not.toContain("Realised savings are not measured") // behind the (i), in the popup
  })

  it("name a month with no figure under the chart -- it is a gap in the line, never a zero", () => {
    const html = trendHtml(trends([month(), gap()]))
    expect(html.match(/No figure for Nov 2026./g)).toHaveLength(3)
    expect(html).not.toContain("0.00M")
  })

  it("name the month only on the card whose figure is missing: a stale stockout reading leaves the other two alone", () => {
    const html = trendHtml(trends([month(), month({ month: "2026-11-01", label: "Nov 2026", stockout_valid: false, stockout_at_risk: null,
      stockout_evaluated: null, note: "Stockout risk not shown: its usage was last built 31 May 2026, too far from this month." })]))
    expect(html.match(/No figure for Nov 2026./g)).toHaveLength(1)
  })

  it("say nothing about gaps when every month was measured", () => {
    expect(trendHtml(trends([month()]))).not.toContain("No figure for")
  })

  it("say that no month has a value yet, rather than draw an empty chart", () => {
    const html = trendHtml(trends([gap()]))
    expect(html.match(/No month has a measured value yet./g)).toHaveLength(3)
    expect(html).not.toContain("No figure for") // there is no chart to put it under
  })
})

describe("the quarter-end position", () => {
  it("shows the last months valid snapshot with its date, and each average with how many records it is over", () => {
    const html = endHtml(trends([month()]))
    expect(html).toContain("saved Dec 2026 month-end snapshot")
    expect(html).toContain("4 Jan 2027")
    expect(html).toContain("25.5")
    expect(html).toContain("1,234")
    expect(html).toContain("Records")
  })

  it("says Not available and why when there is no valid quarter-end snapshot", () => {
    const html = endHtml(trends([month()], end({ status: "NOT_AVAILABLE", reason: "No snapshot was captured for Dec 2026.", stock_levels: [] })))
    expect(html).toContain("Not available")
    expect(html).toContain("No snapshot was captured for Dec 2026.")
    expect(html).not.toContain("Records")
  })

  it("names the latest snapshot available but never presents it as the quarter-end", () => {
    const html = endHtml(trends([month()], end({
      status: "NOT_AVAILABLE", reason: "No snapshot was captured for Dec 2026.", stock_levels: [],
      latest_available_month: "2026-11-01", latest_available_label: "Nov 2026", latest_available_measured_on: "2026-12-03",
    })))
    expect(html).toContain("The latest snapshot available is Nov 2026, measured 3 Dec 2026")
    expect(html).toContain("not shown as the quarter-end")
    expect(html).not.toContain("saved Nov 2026 month-end snapshot")
  })
})
