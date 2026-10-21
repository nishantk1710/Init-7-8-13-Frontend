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
  it("show what each month measured, in millions for money, with how it was measured", () => {
    const html = trendHtml(trends([month()]))
    expect(html).toContain("Oct 2026")
    expect(html).toContain("Month-end snapshot")
    expect(html).toContain("3 Nov 2026")
    expect(html).toContain("1.50M")
    expect(html).toContain("−2.00M")
    expect(html).toContain("of 50 judged")
  })

  it("show a month with no snapshot as a blank row that says so -- never as zero", () => {
    const html = trendHtml(
      trends([month({ state: "MISSING", measured_on: null, stockout_at_risk: null, stockout_evaluated: null, excess_opportunity: null,
        net_rop_value_impact: null, note: "No snapshot was captured for this month, and a past month cannot be rebuilt." })]),
    )
    expect(html).toContain("No snapshot")
    expect(html).toContain("cannot be rebuilt")
    expect(html).not.toContain("0.00M")
  })

  it("leave a stale stockout reading out and say why, while keeping the excess and working capital figures", () => {
    const html = trendHtml(trends([month({ stockout_valid: false, stockout_at_risk: null, stockout_evaluated: null,
      note: "Stockout risk not shown: its usage was last built 31 May 2026, too far from this month." })]))
    expect(html).toContain("Stockout risk not shown")
    expect(html).toContain("31 May 2026")
    expect(html).toContain("1.50M")
    expect(html).not.toContain("of 50 judged")
  })

  it("mark a month still running as a rolling reading, and one captured late as not month-end", () => {
    expect(trendHtml(trends([month({ state: "OPEN", month_end_valid: false })]))).toContain("Rolling reading")
    expect(trendHtml(trends([month({ month_end_valid: false })]))).toContain("Snapshot, not month-end")
  })

  it("show the change in the working capital estimate between months, and the revision when a month was re-measured", () => {
    const html = trendHtml(trends([month({ net_rop_change_from_previous: "-200000.00", revision: 3 })]))
    expect(html).toContain("−0.20M")
    expect(html).toContain("revision 3")
  })

  it("say that counts are never added across months and that an estimate is not a saving", () => {
    const html = trendHtml(trends([month()], end(), ["Realised savings are not measured: nothing records stock that was actually released."]))
    expect(html).toContain("never added into a quarter total")
    expect(html).toContain("Realised savings are not measured")
  })

  it("list which months have no snapshot", () => {
    expect(trendHtml(trends([month()], end(), ["No saved snapshot for Nov 2026, Dec 2026."]))).toContain("No saved snapshot for Nov 2026, Dec 2026.")
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
