import { describe, expect, it } from "vitest"

import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { valueChangeView } from "./value-change"

function rec(overrides: { impact: number | null; currentRop?: number; recommendedRop?: number; blocked?: boolean }) {
  return {
    workingCapitalImpact: overrides.impact,
    current: { rop: overrides.currentRop ?? 1, safetyStock: 0, maxStock: 0 },
    recommended: { rop: overrides.recommendedRop ?? 2, safetyStock: 0, maxStock: 0 },
    factors: overrides.blocked ? [{ label: "Blocked", detail: "x" }] : [],
  } as unknown as Recommendation
}

describe("valueChangeView", () => {
  it("a higher reorder point ties capital up: the absolute amount, going up", () => {
    // 1 -> 2 at 365,018 a unit: the backend sends -365,018.
    expect(valueChangeView(rec({ impact: -365018, currentRop: 1, recommendedRop: 2 }))).toEqual({
      kind: "tied-up",
      amount: 365018,
      ropPercent: 100,
    })
  })

  it("a lower reorder point releases capital: the absolute amount, going down", () => {
    expect(valueChangeView(rec({ impact: 300, currentRop: 5, recommendedRop: 2 }))).toEqual({
      kind: "released",
      amount: 300,
      ropPercent: -60,
    })
  })

  it("an unchanged reorder point is a real zero, with no percentage", () => {
    expect(valueChangeView(rec({ impact: 0, currentRop: 3, recommendedRop: 3 }))).toEqual({
      kind: "unchanged",
      amount: 0,
      ropPercent: null,
    })
  })

  it("never carries a sign on the amount", () => {
    for (const impact of [-1500, 1500, 0]) {
      const view = valueChangeView(rec({ impact }))
      expect(view.kind === "not-computed" || view.kind === "not-available" ? 0 : view.amount).toBeGreaterThanOrEqual(0)
    }
  })

  it("keeps the ROP percentage, and leaves it out when the current reorder point is 0", () => {
    expect(valueChangeView(rec({ impact: -10, currentRop: 4, recommendedRop: 6 }))).toMatchObject({ ropPercent: 50 })
    expect(valueChangeView(rec({ impact: -10, currentRop: 0, recommendedRop: 2 }))).toMatchObject({ ropPercent: null })
  })

  it("an impact the backend could not calculate is not available, never 0", () => {
    expect(valueChangeView(rec({ impact: null }))).toEqual({ kind: "not-available" })
  })

  it("a blocked recommendation is not computed, even when it carries numbers", () => {
    expect(valueChangeView(rec({ impact: 0, currentRop: 0, recommendedRop: 0, blocked: true }))).toEqual({
      kind: "not-computed",
    })
  })
})
