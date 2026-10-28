import { describe, expect, it } from "vitest"

import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { filterByValueChange, sortByValueChange, valueChangeView } from "./value-change"

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

describe("sortByValueChange", () => {
  const row = (id: string, impact: number | null, blocked = false) =>
    ({ ...rec({ impact, blocked }), id }) as unknown as Recommendation
  const ids = (recs: Recommendation[]) => recs.map((r) => (r as unknown as { id: string }).id)
  const rows = [
    row("tied-small", -10),
    row("none", null),
    row("released-big", 500),
    row("unchanged", 0),
    row("blocked", 999, true),
    row("tied-big", -300),
    row("released-small", 20),
  ]

  it("released first: largest release at the top, then unchanged, then the most tied up", () => {
    expect(ids(sortByValueChange(rows, "released-first")).slice(0, 5)).toEqual([
      "released-big",
      "released-small",
      "unchanged",
      "tied-small",
      "tied-big",
    ])
  })

  it("tied up first: the most tied up at the top", () => {
    expect(ids(sortByValueChange(rows, "tied-up-first")).slice(0, 5)).toEqual([
      "tied-big",
      "tied-small",
      "unchanged",
      "released-small",
      "released-big",
    ])
  })

  it("rows with no figure come last either way and are never ranked as 0", () => {
    expect(ids(sortByValueChange(rows, "released-first")).slice(5)).toEqual(["none", "blocked"])
    expect(ids(sortByValueChange(rows, "tied-up-first")).slice(5)).toEqual(["none", "blocked"])
  })

  it("a direction shows only that direction: no unchanged, no missing figure, nothing from the other side", () => {
    expect(ids(filterByValueChange(rows, "released-first"))).toEqual(["released-big", "released-small"])
    expect(ids(filterByValueChange(rows, "tied-up-first"))).toEqual(["tied-small", "tied-big"])
  })

  it("no sort filters nothing", () => {
    expect(filterByValueChange(rows, null)).toBe(rows)
  })

  it("no sort keeps the order given, and does not change the input", () => {
    expect(sortByValueChange(rows, null)).toBe(rows)
    sortByValueChange(rows, "released-first")
    expect(ids(rows)[0]).toBe("tied-small")
  })
})
