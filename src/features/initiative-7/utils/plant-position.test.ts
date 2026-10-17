// The Overview's stockout / excess "position by plant": counts only, one bar per scope.

import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchRecommendationSummary, type RecommendationSummaryStats } from "@/features/initiative-7/services/i7-api"
import { formatShare, positionBars, stockoutAsOf, toPlantPosition, type PlantPosition } from "./plant-position"

function stats(overrides: Partial<RecommendationSummaryStats> = {}): RecommendationSummaryStats {
  return {
    total: 1000,
    byStatus: [], byCriticality: [], byCircuit: [], byRisk: [], byPlant: [],
    oarCount: 0, normalCount: 0, awaitingApprovalCount: 0, readyForReviewCount: 0, notEvaluableCount: 0,
    currency: null,
    netSafetyStockValueImpact: -1_317_618_228_488,
    criticalStockoutRiskCount: 530,
    stockoutRiskEvaluatedCount: 800,
    stockoutRiskInsufficientDataCount: 40,
    stockoutRiskAsOf: "2026-05-31",
    excessInventoryCandidatesCount: 120,
    excessInventoryOpportunity: 400_409_860_446,
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("toPlantPosition", () => {
  it("keeps the counts and drops every money figure", () => {
    const position = toPlantPosition("1300", stats())
    expect(position).toEqual({
      scope: "1300",
      total: 1000,
      stockoutRisk: 530,
      stockoutEvaluated: 800,
      stockoutAsOf: "2026-05-31",
      excess: 120,
    })
    expect(JSON.stringify(position)).not.toContain("400409860446")
    expect(JSON.stringify(position)).not.toContain("1317618228488")
  })
})

describe("formatShare", () => {
  it("rounds whole percentages above 10 and keeps a decimal below", () => {
    expect(formatShare(530, 1000)).toBe("53%")
    expect(formatShare(4, 1000)).toBe("0.4%")
    expect(formatShare(120, 1000)).toBe("12%")
  })

  it("says 0% for none, and nothing at all when there is nothing to divide by", () => {
    expect(formatShare(0, 1000)).toBe("0%")
    expect(formatShare(0, 0)).toBeNull()
  })
})

describe("positionBars", () => {
  const positions: PlantPosition[] = [
    { scope: "1500", total: 200, stockoutRisk: 20, stockoutEvaluated: 50, stockoutAsOf: "2026-05-31", excess: 5 },
    { scope: "ALL", total: 1000, stockoutRisk: 530, stockoutEvaluated: 800, stockoutAsOf: "2026-05-31", excess: 120 },
    { scope: "1300", total: 800, stockoutRisk: 510, stockoutEvaluated: 750, stockoutAsOf: "2026-05-31", excess: 115 },
  ]

  it("is in the fixed All, 1300, 1500 order whatever order the data arrived in", () => {
    expect(positionBars(positions, "stockoutRisk").map((bar) => bar.scope)).toEqual(["ALL", "1300", "1500"])
  })

  it("carries the chosen metric and each scope's own total", () => {
    expect(positionBars(positions, "excess")).toEqual([
      { scope: "ALL", value: 120, total: 1000 },
      { scope: "1300", value: 115, total: 800 },
      { scope: "1500", value: 5, total: 200 },
    ])
  })

  it("takes the stockout bars out of the material-plants that could be judged, not all of them", () => {
    expect(positionBars(positions, "stockoutRisk")).toEqual([
      { scope: "ALL", value: 530, total: 800 },
      { scope: "1300", value: 510, total: 750 },
      { scope: "1500", value: 20, total: 50 },
    ])
  })

  it("leaves out a scope that has no position instead of inventing a zero", () => {
    expect(positionBars(positions.filter((p) => p.scope !== "1500"), "excess").map((bar) => bar.scope)).toEqual([
      "ALL",
      "1300",
    ])
  })

  it("keeps a real zero", () => {
    expect(
      positionBars([{ scope: "ALL", total: 10, stockoutRisk: 0, stockoutEvaluated: 4, stockoutAsOf: null, excess: 0 }], "excess")[0].value,
    ).toBe(0)
  })
})

describe("stockoutAsOf", () => {
  const at = (scope: PlantPosition["scope"], asOf: string | null): PlantPosition => ({
    scope,
    total: 1,
    stockoutRisk: 0,
    stockoutEvaluated: 0,
    stockoutAsOf: asOf,
    excess: 0,
  })

  it("is the date the figures were read as of", () => {
    expect(stockoutAsOf([at("ALL", "2026-05-31"), at("1300", "2026-05-31")])).toBe("2026-05-31")
  })

  it("is null when the usage has not been built, so the counts are not mistaken for zero", () => {
    expect(stockoutAsOf([at("ALL", null), at("1300", null)])).toBeNull()
    expect(stockoutAsOf([])).toBeNull()
  })
})

describe("the requests behind the bars", () => {
  it("asks the existing summary endpoint for each plant, and for all plants with no filter", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url))
      return new Response(
        JSON.stringify({
          total: 5, by_status: [], by_criticality: [], by_circuit: [], by_risk: [], by_plant: [], oar_count: 0,
          normal_count: 0, awaiting_approval_count: 0, ready_for_review_count: 0, not_evaluable_count: 0,
          currency: null, net_safety_stock_value_impact: null, critical_stockout_risk_count: 2,
          excess_inventory_candidates_count: 1, excess_inventory_opportunity: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    await fetchRecommendationSummary({})
    await fetchRecommendationSummary({ plant: "1300" })
    await fetchRecommendationSummary({ plant: "1500" })
    expect(calls[0]).toContain("/recommendations/summary")
    expect(new URL(calls[0], "http://x").searchParams.get("plant")).toBeNull()
    expect(new URL(calls[1], "http://x").searchParams.get("plant")).toBe("1300")
    expect(new URL(calls[2], "http://x").searchParams.get("plant")).toBe("1500")
  })
})
