// Scoping the Forecast vs Actual chart to one report period.
//
// The backend returns the latest N months of backtests, whatever the quarter. A Quarterly Report for
// Q3 should show July, August and September, not the last twelve months, so the report asks for enough
// months to reach back to its period and then keeps only the months inside it.

/** The period a report covers, as the report states it: ISO dates, both ends inclusive. */
export interface ForecastPeriod {
  /** First day, "2026-07-01". */
  start: string
  /** Last day, "2026-09-30". */
  end: string
  /** Shown in messages, for example "Q3 2026". */
  label?: string
}

/** "2026-07-01" or "2026-07" -> 2026 * 12 + 6, a month number that can be compared and subtracted. */
function monthIndex(iso: string): number {
  const [year, month] = iso.split("-")
  return Number(year) * 12 + (Number(month) - 1)
}

/** How many of the latest months to ask the backend for so the period's first month is included:
 * the months from the period's start to today, plus one, never fewer than `minimum` and never more than
 * the backend's own limit. */
export function monthsToCoverPeriod(periodStart: string, now: Date = new Date(), minimum = 12, maximum = 60): number {
  const needed = now.getFullYear() * 12 + now.getMonth() - monthIndex(periodStart) + 1
  return Math.min(maximum, Math.max(minimum, needed))
}

/** Whether a backtest month ("2026-07-01") falls inside the period, comparing whole months. */
export function isInPeriod(isoMonth: string, period: Pick<ForecastPeriod, "start" | "end">): boolean {
  const month = monthIndex(isoMonth)
  return month >= monthIndex(period.start) && month <= monthIndex(period.end)
}

/** Only the points inside the period, in their original order. */
export function filterToPeriod<T extends { period: string }>(points: T[], period: Pick<ForecastPeriod, "start" | "end">): T[] {
  return points.filter((point) => isInPeriod(point.period, period))
}

/** The first and last month any point covers, for the "history exists for ..." message; null if none. */
export function availableRange(points: { period: string }[]): { first: string; last: string } | null {
  if (points.length === 0) return null
  const months = points.map((point) => point.period).sort()
  return { first: months[0], last: months[months.length - 1] }
}
