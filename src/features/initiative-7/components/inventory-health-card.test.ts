// The Overview's Stockout Risk Distribution is on the High Stockout Risk card's definition: High is the
// at-risk count, Low the judged material-plants that are not, and nothing else is drawn.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { InventoryHealthCard } from "./inventory-health-card"

function render() {
  return renderToStaticMarkup(
    createElement(InventoryHealthCard, {
      recommendations: [],
      visibleTiers: ["high", "low"],
      riskOverride: {
        counts: [
          { level: "high", count: 891 },
          { level: "low", count: 9_109 },
        ],
        total: 10_000,
      },
      footnote: "As of 31 May 2026 · 503 need data, not counted above.",
    }),
  )
}

describe("InventoryHealthCard with visibleTiers", () => {
  it("shows the High count and its share of the judged total, the same figure as the KPI card", () => {
    const markup = render()
    expect(markup).toContain("891")
    expect(markup).toContain("8.9%")
  })

  it("draws only the tiers it was given -- no empty Critical or Medium", () => {
    const markup = render()
    expect(markup).toContain("High")
    expect(markup).toContain("Low")
    expect(markup).not.toContain("Medium")
    expect(markup).not.toContain("Critical")
  })

  it("carries the footnote, so the material-plants that could not be judged are named", () => {
    expect(render()).toContain("503 need data, not counted above.")
  })
})
