// Shaping the recorded KPI history into chart series.
//
// The two Overview trend cards plot what the backend saved when each recommendation run
// finished. Nothing here fills a gap: a point with no stockout count has no stockout dot (it is
// not drawn as zero), and a point with no priced excess has no opportunity dot.

import type { RecommendationTrends, TrendPoint } from "@/features/initiative-7/services/i7-api"

export interface ChartPoint {
  /** Milliseconds since epoch: the real snapshot time, so spacing on the axis is true. */
  t: number
  source: TrendPoint["source"]
  value: number | null
  currency: string | null
}

/** Stockout risk: only points where the on-hand stock of that day was recorded. */
export function stockoutSeries(trends: RecommendationTrends): ChartPoint[] {
  return trends.points
    .filter((point) => point.stockoutRiskCount !== null)
    .map((point) => ({
      t: Date.parse(point.capturedAt),
      source: point.source,
      value: point.stockoutRiskCount,
      currency: null,
    }))
}

export interface ExcessChartPoint {
  t: number
  source: TrendPoint["source"]
  count: number
  /** null when no excess row had a price: a gap in the line, never zero. */
  opportunity: number | null
  currency: string | null
}

export function excessSeries(trends: RecommendationTrends): ExcessChartPoint[] {
  return trends.points.map((point) => ({
    t: Date.parse(point.capturedAt),
    source: point.source,
    count: point.excessCount,
    opportunity: point.excessOpportunity,
    currency: point.currency,
  }))
}

/** The currency to label the money axis with: the newest point that states one.
 * Null when none does -- the card then says so instead of guessing a symbol. */
export function opportunityCurrency(points: ExcessChartPoint[]): string | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].currency) return points[i].currency
  }
  return null
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const DAY_MONTH_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

/** Axis label for a snapshot time: "15 Oct". */
export function formatTrendDate(t: number): string {
  return DAY_MONTH.format(new Date(t))
}

/** Tooltip label with the real time of the snapshot, in UTC: "15 Oct 2026, 02:14". */
export function formatTrendDateTime(t: number): string {
  return `${DAY_MONTH_TIME.format(new Date(t))} UTC`
}
