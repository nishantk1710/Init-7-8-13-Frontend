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

import { flatSeries, ForecastVsActualChart, hasNoForecast } from "./forecast-vs-actual-chart"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

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
