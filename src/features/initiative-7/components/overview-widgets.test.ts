// The Overview's distribution and adoption widgets while their figures are being fetched: a loader, never "Not available",
// and never the previous filter's chart or a chart of zeros -- but the real "Not available" and the real chart are unchanged.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AdoptionRateCard, StockoutRiskDistribution } from "@/features/initiative-7/components/overview-widgets"

const workspace = readFileSync(join(process.cwd(), "src/features/initiative-7/components/live-overview-workspace.tsx"), "utf8")
const FIGURES = { atRisk: 891, evaluated: 9916, insufficient: 503, asOf: "2026-05-31" }

describe("StockoutRiskDistribution", () => {
  it("shows a loader while loading, whatever figures it was given", () => {
    const html = renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: FIGURES, loading: true }))
    expect(html).toContain('role="status"')
    expect(html).toContain("Loading stockout risk distribution")
    expect(html).not.toContain("Not available")
    expect(html).not.toContain("891")
  })

  it("shows a loader, not the backend wording, when there are no figures yet and it is loading", () => {
    const html = renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: null, loading: true }))
    expect(html).not.toContain("not available from the backend")
    expect(html).not.toContain("Not available")
  })

  it("still says Not available, with its reason, when loading is over and there is nothing to show", () => {
    const html = renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: null, unavailable: "could not be loaded from the backend" }))
    expect(html).toContain("Not available")
    expect(html).toContain("could not be loaded from the backend")
  })

  it("draws the distribution once loaded", () => {
    const html = renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: FIGURES }))
    expect(html).toContain("891")
    expect(html).not.toContain('role="status"')
  })
})

describe("AdoptionRateCard", () => {
  const summary = { totalEvaluated: 10, adoptedCount: 1, partiallyAdoptedCount: 0, notAdoptedCount: 0, unknownCount: 9, adoptionRatePercentage: 100 }
  const base = { plant: "all", onPlantChange: () => {} }

  it("shows a loader in place of the chart while loading, not the previous bars or a chart of zeros", () => {
    const html = renderToStaticMarkup(createElement(AdoptionRateCard, { ...base, summary, loading: true }))
    expect(html).toContain("Loading SAP adoption")
    expect(html).not.toContain("adoption rate")
    expect(html).not.toContain("Pending")
    const empty = renderToStaticMarkup(createElement(AdoptionRateCard, { ...base, summary: null, loading: true }))
    expect(empty).toContain("Loading SAP adoption")
    expect(empty).not.toContain("recommendation(s) tracked")
  })

  it("draws the chart once loaded", () => {
    const html = renderToStaticMarkup(createElement(AdoptionRateCard, { ...base, summary }))
    expect(html).toContain("Pending")
    expect(html).not.toContain("Loading SAP adoption")
  })
})

describe("the Overview passes what is loading", () => {
  it("tells the cards and the distribution when the summary is being fetched, and the adoption card when its counts are", () => {
    expect(workspace).toContain("summaryRefreshing")
    expect(workspace).toContain("stockout: summaryRefreshing")
    expect(workspace).toContain("adopted: adoptionLoading")
    expect(workspace).toContain("loading={summaryRefreshing}")
    expect(workspace).toContain("loading={adoptionLoading}")
  })

  it("no longer shows a 'loading…' reason in place of a figure", () => {
    expect(workspace).not.toContain('"loading…"')
  })

  it("does not call a wait a failure: the filter that cannot be narrowed is still a reason, not a loader", () => {
    expect(workspace).toContain("summaryLoading && !criticalityCannotNarrow")
  })
})

describe("the chart loaders are the ring", () => {
  it("the distribution and the adoption card show it, not grey bars", () => {
    const distribution = renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: null, loading: true }))
    const adoption = renderToStaticMarkup(createElement(AdoptionRateCard, { plant: "all", onPlantChange: () => {}, summary: null, loading: true }))
    for (const html of [distribution, adoption]) {
      expect(html).toContain("chart-loader-ring")
      expect(html.match(/<circle /g)).toHaveLength(2)  // the track and the arc
      expect(html).not.toContain("spinner-petals")
      expect(html).not.toContain("animate-pulse")  // not the grey bars
    }
  })

  it("keeps the height of what it stands in for, so the cards do not change size when the figures arrive", () => {
    expect(renderToStaticMarkup(createElement(StockoutRiskDistribution, { figures: null, loading: true }))).toContain("h-[150px]")
    expect(renderToStaticMarkup(createElement(AdoptionRateCard, { plant: "all", onPlantChange: () => {}, summary: null, loading: true }))).toContain("h-[290px]")
  })
})
