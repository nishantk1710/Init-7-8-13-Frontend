// The recommendation-detail "Consumption history & forecast" chart.
//
// A cold-start (OAR) material has no forecast -- its reorder point, safety stock and
// max stock are borrowed from similar materials -- so the chart must not draw a flat
// "Forecast 0.0" for it. A normal material with a forecast keeps its Forecast line.
//
// Rendered to static markup with react-dom/server (this project's vitest runs without
// a DOM), as inventory-portfolio-kpis.test.ts does. Effects do not run on the server,
// so the chart renders its first pass: the legend and the explanatory note are plain
// markup and are what these assertions read.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { actualWithBacktest, flatSeries, ForecastVsActualChart, hasNoForecast } from "./forecast-vs-actual-chart"
import type { ConsumptionPoint, Recommendation } from "@/features/initiative-7/types/inventory"
import { aggregateConsumption } from "@/features/initiative-7/utils/inventory-calc"

// Only the fields the chart reads; the rest of a Recommendation is irrelevant here.
function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: "REC-1",
    demandPattern: "Smooth",
    avgDailyConsumption: 12.5,
    consumptionHistory: [
      { period: "Jan 2026", qty: 10 },
      { period: "Feb 2026", qty: 0 },
      { period: "Mar 2026", qty: 30 },
    ],
    ...overrides,
  } as unknown as Recommendation
}

const OAR_GUIDANCE = {
  similarMaterials: [],
  suggestedRop: 8,
  suggestedSafetyStock: 4,
  confidence: "Medium" as const,
  factors: [],
  note: "",
}

function render(recommendations: Recommendation[]) {
  return renderToStaticMarkup(createElement(ForecastVsActualChart, { recommendations }))
}

describe("hasNoForecast", () => {
  it("is true for one cold-start material", () => {
    expect(hasNoForecast([rec({ demandPattern: "Cold start" })])).toBe(true)
  })

  it("is true for one OAR material even when its demand pattern is something else", () => {
    expect(hasNoForecast([rec({ oarColdStart: OAR_GUIDANCE })])).toBe(true)
  })

  it("is false for a normal material that has a forecast", () => {
    expect(hasNoForecast([rec({ demandPattern: "Intermittent" })])).toBe(false)
  })

  it("is false when several materials are in view (the flat line is a portfolio figure)", () => {
    expect(hasNoForecast([rec({ demandPattern: "Cold start" }), rec({ id: "REC-2" })])).toBe(false)
  })
})

describe("flatSeries", () => {
  const actuals = [
    { period: "Jan 2026", qty: 10 },
    { period: "Feb 2026", qty: 0 },
    { period: "Mar 2026", qty: 30 },
  ]

  it("keeps every month, including a month with no usage, as an explicit zero", () => {
    expect(flatSeries(actuals, 12.5, false).map((p) => p.actual)).toEqual([10, 0, 30])
  })

  it("draws the backend's forecast rate flat across a normal material", () => {
    expect(flatSeries(actuals, 12.54, false).map((p) => p.forecast)).toEqual([12.5, 12.5, 12.5])
  })

  it("leaves the forecast missing, not zero, for a material with no forecast", () => {
    const forecasts = flatSeries(actuals, 0, true).map((p) => p.forecast)
    expect(forecasts).toEqual([null, null, null])
    expect(forecasts).not.toContain(0)
  })

  it("does not turn a month of zero usage into a gap (no null actuals)", () => {
    expect(flatSeries(actuals, 1, true).every((p) => p.actual !== null)).toBe(true)
  })
})

// The material that showed "6 units" over 12 months but a chart that added up to 4: 2 units in
// March 2026, before the forecast backtest begins (April 2026), and 1 each in June, August,
// September and October.
const MONTHS = [
  "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
  "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
]
const LABELS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]
const USED: Record<string, number> = { "2026-03": 2, "2026-06": 1, "2026-08": 1, "2026-09": 1, "2026-10": 1 }
const TWELVE_MONTHS: ConsumptionPoint[] = MONTHS.map((month, i) => ({
  period: LABELS[i],
  qty: USED[month] ?? 0,
  month,
}))
// The model's own one-step predictions: only April to October exist.
const BACKTEST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m) => ({
  period: `${m}-01`,
  predicted: 0.56,
}))

describe("actualWithBacktest", () => {
  it("shows all 12 months, so the actual line adds up to the annual consumption", () => {
    const points = actualWithBacktest(TWELVE_MONTHS, BACKTEST, false)!
    expect(points).toHaveLength(12)
    expect(points.reduce((sum, p) => sum + (p.actual ?? 0), 0)).toBe(6)
  })

  it("keeps the month the backtest does not cover, with its real consumption", () => {
    const march = actualWithBacktest(TWELVE_MONTHS, BACKTEST, false)!.find((p) => p.period === "Mar")!
    expect(march.actual).toBe(2)
    expect(march.forecast).toBeNull()
  })

  it("draws the forecast only on the months that were backtested, never filling in earlier ones", () => {
    const points = actualWithBacktest(TWELVE_MONTHS, BACKTEST, false)!
    expect(points.slice(0, 5).map((p) => p.forecast)).toEqual([null, null, null, null, null])
    expect(points.slice(5).map((p) => p.forecast)).toEqual([0.56, 0.56, 0.56, 0.56, 0.56, 0.56, 0.56])
  })

  it("keeps a month with no usage as an explicit zero, not a gap", () => {
    const points = actualWithBacktest(TWELVE_MONTHS, BACKTEST, false)!
    expect(points.every((p) => p.actual !== null)).toBe(true)
    expect(points.find((p) => p.period === "Apr")!.actual).toBe(0)
  })

  it("matches by calendar month, so a prediction for another year's same month is not used", () => {
    const otherYear = [{ period: "2025-03-01", predicted: 9 }]
    const march = actualWithBacktest(TWELVE_MONTHS, otherYear, false)!.find((p) => p.period === "Mar")!
    expect(march.forecast).toBeNull()
  })

  it("leaves a month's forecast missing when the backtest has no prediction for it", () => {
    const gap = [{ period: "2026-06-01", predicted: null }]
    const june = actualWithBacktest(TWELVE_MONTHS, gap, false)!.find((p) => p.period === "Jun")!
    expect(june.forecast).toBeNull()
  })

  it("has no forecast at all for a material without one", () => {
    const points = actualWithBacktest(TWELVE_MONTHS, BACKTEST, true)!
    expect(points.every((p) => p.forecast === null)).toBe(true)
  })

  it("cannot match a history that carries no calendar months, and says so by returning null", () => {
    const unlabelled = TWELVE_MONTHS.map(({ period, qty }) => ({ period, qty }))
    expect(actualWithBacktest(unlabelled, BACKTEST, false)).toBeNull()
    expect(actualWithBacktest([], BACKTEST, false)).toBeNull()
  })
})

describe("aggregateConsumption", () => {
  it("carries each month's calendar key so the chart can line it up with the backtest", () => {
    const months = aggregateConsumption([rec({ consumptionHistory: TWELVE_MONTHS })]).map((p) => p.month)
    expect(months).toEqual(MONTHS)
  })

  it("still works for a history that has no calendar months", () => {
    const [first] = aggregateConsumption([rec({})])
    expect(first).toEqual({ period: "Jan 2026", qty: 10 })
  })
})

describe("the chart for a material with no forecast", () => {
  const markup = render([rec({ demandPattern: "Cold start", oarColdStart: OAR_GUIDANCE })])

  it("says there is no forecast and why", () => {
    expect(markup).toContain("There is no forecast for this material")
    expect(markup).toContain("estimated from similar materials")
  })

  it("has no Forecast legend entry and never prints a Forecast of zero", () => {
    expect(markup).toContain("Actual")
    expect(markup).not.toMatch(/>\s*Forecast\s*</)
    expect(markup).not.toContain("Forecast 0")
  })
})

describe("the chart for a normal material with a forecast", () => {
  const markup = render([rec({ demandPattern: "Intermittent" })])

  it("keeps the Forecast legend entry", () => {
    expect(markup).toMatch(/>\s*Forecast\s*</)
  })

  it("does not claim the forecast is missing", () => {
    expect(markup).not.toContain("There is no forecast for this material")
  })
})
