// Mock monthly trend series for the Overview and Monitoring pages. Kept as
// deterministic, hand-authored points (not derived at request time) so the
// charts read consistently across renders — the end-of-series values are
// deliberately close to the current RECOMMENDATIONS snapshot for narrative
// continuity, not recomputed from it.

export interface MonthlyCount {
  month: string
  value: number
}

export const STOCKOUT_RISK_TREND: MonthlyCount[] = [
  { month: "Mar", value: 2 },
  { month: "Apr", value: 3 },
  { month: "May", value: 3 },
  { month: "Jun", value: 4 },
  { month: "Jul", value: 4 },
  { month: "Aug", value: 5 },
]

/** Cumulative ZAR opportunity identified from excess-inventory candidates. */
export const EXCESS_INVENTORY_TREND: MonthlyCount[] = [
  { month: "Mar", value: 120_000 },
  { month: "Apr", value: 180_000 },
  { month: "May", value: 260_000 },
  { month: "Jun", value: 410_000 },
  { month: "Jul", value: 610_000 },
  { month: "Aug", value: 840_900 },
]
