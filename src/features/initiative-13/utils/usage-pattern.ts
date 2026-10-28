// How a material has been issued over the movement history -- the Usage
// Pattern cards' label, sentence and month-by-month reading. Display only:
// it reads the monthly series the backend sends (`UsagePattern.months`) and
// reclassifies nothing the backend decided (the aging band stays the backend's).

import type { MonthlyConsumption } from "@/lib/api/i13"

export type UsageKind = "never" | "quiet" | "steady" | "bursts"

/** Nothing issued for this many months, up to the end of the history: gone quiet. */
export const QUIET_AFTER_MONTHS = 6
/** Issued in at least this share of the months: steady. */
export const STEADY_SHARE = 0.5

export const USAGE_KIND_LABEL: Record<UsageKind, string> = {
  never: "Never issued",
  quiet: "Gone quiet",
  steady: "Steady",
  bursts: "In bursts",
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2024-07" -> "Jul 2024"; anything else is returned as it came. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  const index = Number(match[2]) - 1
  return index >= 0 && index < 12 ? `${MONTH_NAMES[index]} ${match[1]}` : month
}

const count = (n: number) => Math.round(n).toLocaleString("en-US")
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`

export type UsageReading = {
  kind: UsageKind
  label: string
  /** Under the label on a card, e.g. "No issue for 13 months". */
  hint: string
  /** The panel's one-sentence reading. */
  story: string
  /** Index into `months` of the busiest month, or -1 with nothing issued. */
  peakIndex: number
  /** Months since the last issue, to the end of the history. */
  quietFor: number
}

export function readUsage(months: MonthlyConsumption[]): UsageReading {
  const issued = months.map((m) => Math.max(0, m.issuedQuantity))
  const total = issued.reduce((a, b) => a + b, 0)
  const active = issued.filter((v) => v > 0).length
  let last = -1
  let peak = -1
  issued.forEach((v, i) => {
    if (v > 0) last = i
    if (v > 0 && (peak < 0 || v > issued[peak])) peak = i
  })
  const quietFor = last < 0 ? months.length : months.length - 1 - last
  const of = `${active} of ${months.length} months`

  if (active === 0) {
    return { kind: "never", label: USAGE_KIND_LABEL.never, hint: `Nothing issued in ${months.length} months`, story: `Nothing was issued in the ${months.length} months of history.`, peakIndex: -1, quietFor }
  }
  const share = Math.round((issued[peak] / total) * 100)
  const peakName = monthLabel(months[peak].month)
  if (quietFor >= QUIET_AFTER_MONTHS) {
    return {
      kind: "quiet",
      label: USAGE_KIND_LABEL.quiet,
      hint: `No issue for ${quietFor} months`,
      story:
        `Last issued in ${monthLabel(months[last].month)}, ${plural(quietFor, "month", "months")} before the history ends.` +
        (share >= 50 ? ` One month (${peakName}) is ${share}% of everything issued.` : ""),
      peakIndex: peak,
      quietFor,
    }
  }
  if (active >= Math.ceil(months.length * STEADY_SHARE)) {
    return {
      kind: "steady",
      label: USAGE_KIND_LABEL.steady,
      hint: `Issued in ${of}`,
      story: `Issued in ${of}, about ${count(total / active)} a month when it moves. Last issue ${monthLabel(months[last].month)}.`,
      peakIndex: peak,
      quietFor,
    }
  }
  return {
    kind: "bursts",
    label: USAGE_KIND_LABEL.bursts,
    hint: `Issued in ${of}`,
    story: `Issued in ${of}, in runs with gaps between. The busiest month (${peakName}) took ${share}%.`,
    peakIndex: peak,
    quietFor,
  }
}

/** 0 = nothing issued, 1-4 = a quarter of the busiest month or more each step. */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0
  const r = value / max
  return r < 0.15 ? 1 : r < 0.4 ? 2 : r < 0.75 ? 3 : 4
}

/** What one month's three figures say together, for the hover card. */
export function monthNote(m: Pick<MonthlyConsumption, "issuedQuantity" | "receivedQuantity">): string {
  const issued = m.issuedQuantity > 0
  const received = m.receivedQuantity > 0
  if (!issued && !received) return "Nothing moved this month."
  if (!issued) return "Received, nothing issued."
  if (!received) return "Issued from stock, nothing received."
  return "Received and issued in the same month."
}

export type YearRow = {
  year: string
  /** Twelve cells, January first; `index` into `months`, or null outside the history. */
  cells: { month: string; index: number | null }[]
}

/** The history as calendar rows, one per year, so a seasonal shape lines up. */
export function yearGrid(months: MonthlyConsumption[]): YearRow[] {
  const byKey = new Map(months.map((m, i) => [m.month, i]))
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort()
  return years.map((year) => ({
    year,
    cells: Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, "0")}`
      return { month, index: byKey.get(month) ?? null }
    }),
  }))
}
