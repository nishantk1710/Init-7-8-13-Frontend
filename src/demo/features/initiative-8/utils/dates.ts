/**
 * The Snapshot's dates are display strings — "22 Aug 2026", or
 * "22 Aug 2026, 10:42" for a timestamp — because that is what the screens
 * print. These turn them into whole days for the arithmetic (days open, days
 * in stage, turnaround, overdue) so every figure is worked out from the dates
 * rather than typed beside them.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const MS_PER_DAY = 86_400_000

/** "22 Aug 2026" or "22 Aug 2026, 10:42" as a day number; undefined if unreadable. */
export function dayOf(display: string | undefined): number | undefined {
  const match = display?.match(/^(\d{1,2}) (\w{3}) (\d{4})/)
  if (!match) return undefined
  const month = MONTHS.indexOf(match[2])
  if (month < 0) return undefined
  return Date.UTC(Number(match[3]), month, Number(match[1])) / MS_PER_DAY
}

/** Sort key that also orders timestamps within a day: "22 Aug 2026, 10:42". */
export function instantOf(display: string | undefined): number {
  const day = dayOf(display)
  if (day === undefined) return 0
  const time = display?.match(/, (\d{1,2}):(\d{2})/)
  return day * 1440 + (time ? Number(time[1]) * 60 + Number(time[2]) : 0)
}

/** A day number back to "22 Aug 2026". */
export function labelOfDay(day: number): string {
  const date = new Date(day * MS_PER_DAY)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Whole days from `from` to `to`. Undefined when either is unreadable. */
export function daysBetween(from: string | undefined, to: string | undefined): number | undefined {
  const a = dayOf(from)
  const b = dayOf(to)
  return a === undefined || b === undefined ? undefined : b - a
}

/** Day-only part of a timestamp: "22 Aug 2026, 10:42" -> "22 Aug 2026". */
export function dateOnly(display: string): string {
  return display.replace(/,.*$/, "")
}
