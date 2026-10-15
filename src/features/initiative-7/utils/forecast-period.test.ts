// The Quarterly Report's Forecast vs Actual chart shows only the months of its quarter.

import { describe, expect, it } from "vitest"

import { availableRange, filterToPeriod, isInPeriod, monthsToCoverPeriod } from "./forecast-period"

/** Backtest months as the backend sends them: Sep 2025 to Aug 2026, as in the live chart. */
const TWELVE_MONTHS = [
  "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01",
  "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01",
].map((period) => ({ period, actual: 1, predicted: 1 }))

const Q3_2026 = { start: "2026-07-01", end: "2026-09-30" }
const Q4_2026 = { start: "2026-10-01", end: "2026-12-31" }
const Q1_2026 = { start: "2026-01-01", end: "2026-03-31" }

describe("filterToPeriod", () => {
  it("keeps only July and August for Q3 2026 -- the months of the quarter that have a backtest", () => {
    expect(filterToPeriod(TWELVE_MONTHS, Q3_2026).map((p) => p.period)).toEqual(["2026-07-01", "2026-08-01"])
  })

  it("keeps exactly the three months of a quarter that is fully covered", () => {
    expect(filterToPeriod(TWELVE_MONTHS, Q1_2026).map((p) => p.period)).toEqual([
      "2026-01-01", "2026-02-01", "2026-03-01",
    ])
  })

  it("is empty for a quarter with no backtest, never padded or filled in", () => {
    expect(filterToPeriod(TWELVE_MONTHS, Q4_2026)).toEqual([])
  })

  it("includes September for a quarter whose last day is the 30th (the end date is inclusive)", () => {
    const withSeptember = [...TWELVE_MONTHS, { period: "2026-09-01", actual: 1, predicted: 1 }]
    expect(filterToPeriod(withSeptember, Q3_2026).map((p) => p.period)).toEqual([
      "2026-07-01", "2026-08-01", "2026-09-01",
    ])
  })

  it("keeps the original order and the other fields untouched", () => {
    const [first] = filterToPeriod([{ period: "2026-07-01", actual: 5, predicted: 7 }], Q3_2026)
    expect(first).toEqual({ period: "2026-07-01", actual: 5, predicted: 7 })
  })
})

describe("isInPeriod", () => {
  it("compares whole months, not days", () => {
    expect(isInPeriod("2026-07-01", Q3_2026)).toBe(true)
    expect(isInPeriod("2026-06-01", Q3_2026)).toBe(false)
    expect(isInPeriod("2026-10-01", Q3_2026)).toBe(false)
  })
})

describe("monthsToCoverPeriod", () => {
  const OCT_2026 = new Date(2026, 9, 15)

  it("asks for enough months to reach back to the quarter's first month", () => {
    expect(monthsToCoverPeriod("2026-07-01", OCT_2026)).toBe(12) // Jul..Oct is only 4: never below the usual 12
    expect(monthsToCoverPeriod("2025-01-01", OCT_2026)).toBe(22)
  })

  it("never asks for more than the backend allows", () => {
    expect(monthsToCoverPeriod("2015-01-01", OCT_2026)).toBe(60)
  })

  it("never asks for fewer than the minimum", () => {
    expect(monthsToCoverPeriod("2026-10-01", OCT_2026)).toBe(12)
  })
})

describe("availableRange", () => {
  it("is the first and last month the backtests cover", () => {
    expect(availableRange(TWELVE_MONTHS)).toEqual({ first: "2025-09-01", last: "2026-08-01" })
  })

  it("is null when there is no history at all", () => {
    expect(availableRange([])).toBeNull()
  })
})
