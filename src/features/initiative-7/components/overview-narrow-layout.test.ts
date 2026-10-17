// The Overview's distribution cards must stay readable when the card is narrow (page zoomed, or a
// small window with the filter rail beside them).
//
// What went wrong: the legend text was cut to "Cri..." or to nothing, and the status legend ran out of
// the card. The fix is a container query on each card, so the card's own width decides the layout. Layout
// itself needs a browser, so these pin the three things the fix depends on: every label is still in the
// markup (nothing is dropped), the container-query wrappers are there, and the label is not set to truncate.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { InventoryHealthCard } from "./inventory-health-card"
import { shortAxisName } from "./plant-position-cards"
import { RecommendationStatusChart } from "./recommendation-status-chart"

describe("Stockout Risk Distribution", () => {
  const markup = renderToStaticMarkup(
    createElement(InventoryHealthCard, {
      recommendations: [],
      riskOverride: {
        total: 18752,
        counts: [
          { level: "critical", count: 833 },
          { level: "high", count: 1147 },
          { level: "medium", count: 205 },
          { level: "low", count: 16567 },
        ],
      },
    }),
  )

  it("keeps every tier's name and count in the markup", () => {
    for (const label of ["Critical", "High", "Medium", "Low"]) expect(markup).toContain(label)
    for (const count of ["833", "1,147", "205", "16,567"]) expect(markup).toContain(count)
  })

  it("lets the card's own width decide the layout (a container query, not a window breakpoint)", () => {
    expect(markup).toContain("@container")
    expect(markup).toContain("flex-col")
    expect(markup).toContain("@[16rem]:flex-row")
  })

  it("no longer cuts a tier's name to nothing", () => {
    expect(markup).toContain("whitespace-nowrap")
    expect(markup).not.toContain('class="truncate"')
  })
})

describe("Stockout Risk Distribution with Critical counted into High", () => {
  const markup = renderToStaticMarkup(
    createElement(InventoryHealthCard, {
      recommendations: [],
      mergeCriticalIntoHigh: true,
      riskOverride: {
        total: 18752,
        counts: [
          { level: "critical", count: 833 },
          { level: "high", count: 1147 },
          { level: "medium", count: 205 },
          { level: "low", count: 16567 },
        ],
      },
    }),
  )

  it("shows High, Medium and Low only, with High the sum of Critical and High", () => {
    for (const label of ["High", "Medium", "Low"]) expect(markup).toContain(label)
    expect(markup).not.toContain("Critical")
    expect(markup).toContain("1,980") // 833 + 1,147
    expect(markup).not.toContain("833")
    expect(markup).not.toContain("1,147")
  })

  it("counts the same way from the rows when there is no backend override", () => {
    const rows = ["critical", "high", "high", "low"].map((risk) => ({ risk })) as never[]
    const local = renderToStaticMarkup(
      createElement(InventoryHealthCard, { recommendations: rows, mergeCriticalIntoHigh: true }),
    )
    expect(local).toContain("3 (75.0%)")
    expect(local).not.toContain("Critical")
  })
})

describe("Recommendation status", () => {
  const markup = renderToStaticMarkup(
    createElement(RecommendationStatusChart, {
      recommendations: [],
      statusOverride: [{ status: "Pending Review", count: 18752 }],
    }),
  )

  it("lists every status, including the zero ones", () => {
    for (const label of ["Pending Review", "In Approval", "Approved", "Implemented", "Returned", "Rejected"]) {
      expect(markup).toContain(label)
    }
    expect(markup).toContain("18,752")
  })

  it("stacks the donut above the legend until the card is wide enough for both side by side", () => {
    expect(markup).toContain("@container")
    expect(markup).toContain("flex-col")
    expect(markup).toContain("@[24rem]:flex-row")
  })
})

describe("the plant position bars' axis names", () => {
  it("drops the plant code so three names fit under three bars", () => {
    expect(shortAxisName("Black Mountain (1300)")).toBe("Black Mountain")
    expect(shortAxisName("Gamsberg (1500)")).toBe("Gamsberg")
  })

  it("leaves a name without a code as it is", () => {
    expect(shortAxisName("All plants")).toBe("All plants")
  })
})
