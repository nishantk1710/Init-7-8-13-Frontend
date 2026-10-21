// The two position cards' states: loading, error, nothing to count, and the bars with their notes.
//
// Rendered to static markup with react-dom/server (this project's vitest runs without a DOM). The
// bars need a browser layout, so these read the text around them -- which is where the promises are:
// counts and not money, and a load failure that is not mistaken for "nothing to count".

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ExcessPositionCard, PlantPositionView, StockoutPositionCard } from "./plant-position-cards"
import type { PlantPositionsState } from "@/features/initiative-7/hooks/use-plant-positions"
import type { PlantPosition } from "@/features/initiative-7/utils/plant-position"

const POSITIONS: PlantPosition[] = [
  { scope: "ALL", total: 18752, stockoutRisk: 890, stockoutEvaluated: 6200, stockoutAsOf: "2026-05-31", excess: 2254 },
  { scope: "1300", total: 18000, stockoutRisk: 850, stockoutEvaluated: 6000, stockoutAsOf: "2026-05-31", excess: 2200 },
  { scope: "1500", total: 752, stockoutRisk: 40, stockoutEvaluated: 200, stockoutAsOf: "2026-05-31", excess: 54 },
]

const loaded = (positions: PlantPosition[]): PlantPositionsState => ({ positions, loading: false, error: null })

describe("loading and failure are separate from empty", () => {
  it("shows neither a message nor a chart note while loading", () => {
    const markup = renderToStaticMarkup(
      createElement(StockoutPositionCard, { state: { positions: [], loading: true, error: null } }),
    )
    expect(markup).not.toContain("No recommendations")
    expect(markup).not.toContain("Could not load")
    expect(markup).not.toContain("as of the latest recommendation analysis")
  })

  it("says it could not load, with the reason, and does not say there is nothing to count", () => {
    const state = { positions: [], loading: false, error: new Error("backend answered 503") }
    const stockout = renderToStaticMarkup(createElement(StockoutPositionCard, { state }))
    expect(stockout).toContain("Could not load the stockout risk position")
    expect(stockout).toContain("backend answered 503")
    expect(stockout).not.toContain("No recommendations to count yet")
    expect(renderToStaticMarkup(createElement(ExcessPositionCard, { state }))).toContain(
      "Could not load the excess inventory position",
    )
  })

  it("says there is nothing to count when every scope is empty", () => {
    const markup = renderToStaticMarkup(
      createElement(StockoutPositionCard, {
        state: loaded(
          POSITIONS.map((position) => ({ ...position, total: 0, stockoutRisk: 0, stockoutEvaluated: 0, excess: 0 })),
        ),
      }),
    )
    expect(markup).toContain("No material-plants could be judged yet.")
  })

  it("says Not available, never zero at risk, when the stockout usage has not been built", () => {
    const markup = renderToStaticMarkup(
      createElement(StockoutPositionCard, {
        state: loaded(POSITIONS.map((position) => ({ ...position, stockoutRisk: 0, stockoutEvaluated: 0, stockoutAsOf: null }))),
      }),
    )
    expect(markup).toContain("Not available")
    expect(markup).toContain("has not been built yet")
    expect(markup).not.toContain("No material-plants could be judged yet.")
  })
})

describe("the bars' notes", () => {
  it("describes the stockout count against the AI Suggested reorder point, as of the latest analysis", () => {
    const markup = renderToStaticMarkup(createElement(StockoutPositionCard, { state: loaded(POSITIONS) }))
    expect(markup).toContain(
      "Material-plants whose stock on hand is below the AI Suggested reorder point, as of the latest recommendation analysis.",
    )
    expect(markup).not.toContain("not yet confirmed by the business")
    expect(markup).not.toContain("builds up")
  })

  it("describes the excess count as a count and not a money value", () => {
    const markup = renderToStaticMarkup(createElement(ExcessPositionCard, { state: loaded(POSITIONS) }))
    expect(markup).toContain("above the recommended maximum, as of the latest recommendation analysis.")
    expect(markup).toContain("A count, not a money value")
    expect(markup).not.toContain("not yet confirmed by the business")
    expect(markup).not.toContain("builds up")
  })

  it("never prints a money amount", () => {
    for (const metric of ["stockoutRisk", "excess"] as const) {
      const markup = renderToStaticMarkup(createElement(PlantPositionView, { state: loaded(POSITIONS), metric }))
      expect(markup).not.toMatch(/[$€£R]\s?\d/)
      expect(markup).not.toMatch(/\b\d{1,3}(,\d{3}){3,}\b/) // nothing in the billions
    }
  })

  it("still draws when one plant has no recommendations (its bar is a real zero)", () => {
    const markup = renderToStaticMarkup(
      createElement(StockoutPositionCard, {
        state: loaded([
          { scope: "ALL", total: 100, stockoutRisk: 40, stockoutEvaluated: 80, stockoutAsOf: "2026-05-31", excess: 5 },
          { scope: "1300", total: 100, stockoutRisk: 40, stockoutEvaluated: 80, stockoutAsOf: "2026-05-31", excess: 5 },
          { scope: "1500", total: 0, stockoutRisk: 0, stockoutEvaluated: 0, stockoutAsOf: "2026-05-31", excess: 0 },
        ]),
      }),
    )
    expect(markup).toContain("AI Suggested reorder point")
    expect(markup).not.toContain("No material-plants could be judged yet.")
  })
})
