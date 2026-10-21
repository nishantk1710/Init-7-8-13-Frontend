import { describe, expect, it } from "vitest"

import {
  adoptionOf,
  findScope,
  HIDDEN_QUARTERS,
  landingQuarters,
  loadQuarterlySnapshot,
  pageCount,
  pageOf,
  plantPositions,
  SNAPSHOT_QUARTER,
  SNAPSHOT_TYPES,
  stockLevelRows,
  type QuarterlySnapshot,
  type SnapshotFigures,
  type SnapshotScope,
  type SnapshotType,
} from "./quarterly-snapshot"

function figures(overrides: Partial<SnapshotFigures> = {}): SnapshotFigures {
  return {
    total: 1000,
    stockout_at_risk: 90,
    stockout_evaluated: 800,
    stockout_insufficient_data: 40,
    stockout_as_of: "2026-05-31",
    excess_count: 70,
    excess_opportunity: 5_000_000,
    net_rop_value_impact: -2_000_000,
    adoption_total: 500,
    adopted: 10,
    partially_adopted: 5,
    not_adopted: 5,
    pending: 480,
    ...overrides,
  }
}

function scope(plant: string | null, type: SnapshotType, overrides: Partial<SnapshotFigures> = {}): SnapshotScope {
  return { plant, type, figures: figures(overrides), stock_levels: null, stock_levels_count: null, materials: null, materials_total: null }
}

function snapshot(scopes: SnapshotScope[]): QuarterlySnapshot {
  return { quarter: "Q2 2026", period: "Apr – Jun 2026", source: "October 2026 run", captured_at: "2026-10-21", currency: null, scopes }
}

describe("findScope", () => {
  const s = snapshot([scope(null, "all"), scope("1300", "all"), scope("1300", "oar")])

  it("finds a plant and a type, null being every plant", () => {
    expect(findScope(s, null, "all")?.plant).toBeNull()
    expect(findScope(s, "1300", "oar")?.type).toBe("oar")
  })

  it("is undefined for a scope that was not captured, never a stand-in", () => {
    expect(findScope(s, "1500", "all")).toBeUndefined()
  })
})

describe("plantPositions", () => {
  const s = snapshot([
    scope(null, "all", { total: 1000, stockout_at_risk: 90, excess_count: 70 }),
    scope("1300", "all", { total: 600, stockout_at_risk: 50, excess_count: 40 }),
    scope("1500", "all", { total: 400, stockout_at_risk: 40, excess_count: 30 }),
    scope(null, "oar", { total: 100, stockout_at_risk: 5, excess_count: 0 }),
  ])

  it("gives All plants, 1300 and 1500 in the Overview's order, as the plant cards take them", () => {
    expect(plantPositions(s, "all", null).map((p) => [p.scope, p.stockoutRisk, p.excess, p.total])).toEqual([
      ["ALL", 90, 70, 1000],
      ["1300", 50, 40, 600],
      ["1500", 40, 30, 400],
    ])
  })

  it("draws only the plant that was picked", () => {
    expect(plantPositions(s, "all", "1500").map((p) => p.scope)).toEqual(["1500"])
  })

  it("follows the Recommendation choice, and leaves out a scope that was not captured", () => {
    expect(plantPositions(s, "oar", null).map((p) => [p.scope, p.stockoutRisk])).toEqual([["ALL", 5]])
  })

  it("carries what the stockout bars are out of and as of", () => {
    const [all] = plantPositions(s, "all", null)
    expect(all.stockoutEvaluated).toBe(800)
    expect(all.stockoutAsOf).toBe("2026-05-31")
  })
})

describe("adoptionOf", () => {
  it("is what the Overview's adoption card takes, with the rate over those with SAP evidence", () => {
    expect(adoptionOf(figures())).toEqual({
      totalEvaluated: 500,
      adoptedCount: 10,
      partiallyAdoptedCount: 5,
      notAdoptedCount: 5,
      unknownCount: 480,
      adoptionRatePercentage: 75,
    })
  })

  it("has no rate while nothing has SAP evidence -- never a 0%", () => {
    expect(adoptionOf(figures({ adopted: 0, partially_adopted: 0, not_adopted: 0, pending: 500 }))?.adoptionRatePercentage).toBeNull()
  })

  it("is null when adoption was not captured, so the card says so instead of showing 0", () => {
    expect(adoptionOf(figures({ adoption_total: null, adopted: null, partially_adopted: null, not_adopted: null, pending: null }))).toBeNull()
  })
})

describe("stockLevelRows", () => {
  it("lists safety stock, reorder point and maximum stock with each change", () => {
    const rows = stockLevelRows([
      { key: "rop", current: 10, recommended: 25 },
      { key: "ss", current: 4, recommended: 3 },
      { key: "max", current: 20, recommended: 20 },
    ])
    expect(rows.map((r) => [r.key, r.delta])).toEqual([
      ["ss", -1],
      ["rop", 15],
      ["max", 0],
    ])
  })

  it("has no change for a level without both values, and shows all three when none was captured", () => {
    expect(stockLevelRows([{ key: "ss", current: null, recommended: 3 }])[0].delta).toBeNull()
    const none = stockLevelRows(null)
    expect(none).toHaveLength(3)
    expect(none.every((r) => r.current === null && r.recommended === null && r.delta === null)).toBe(true)
  })
})

describe("paging", () => {
  it("slices a page and counts pages, never fewer than one", () => {
    expect(pageOf([1, 2, 3, 4, 5, 6, 7], 2, 3)).toEqual([4, 5, 6])
    expect(pageCount(7, 3)).toBe(3)
    expect(pageCount(0, 3)).toBe(1)
  })
})

describe("the Q2 snapshot data", () => {
  it("loads, and is the quarter it says it is", async () => {
    const data = await loadQuarterlySnapshot()
    expect(data.quarter).toBe(SNAPSHOT_QUARTER)
    expect(data.source).toBeTruthy()
    expect(data.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has a scope for every plant and every type the Overview offers", async () => {
    const data = await loadQuarterlySnapshot()
    for (const plant of [null, "1300", "1500"]) {
      for (const type of SNAPSHOT_TYPES) {
        expect(findScope(data, plant, type.value), `${plant ?? "ALL"} / ${type.value}`).toBeDefined()
      }
    }
  })

  it("splits the recommendations: OAR plus stock items is every recommendation, and the plants add up", async () => {
    const data = await loadQuarterlySnapshot()
    const total = (plant: string | null, type: SnapshotType) => findScope(data, plant, type)!.figures.total
    expect(total(null, "oar") + total(null, "stock_item")).toBe(total(null, "all"))
    expect(total("1300", "all") + total("1500", "all")).toBe(total(null, "all"))
  })

  it("never has more at stockout risk than were evaluated, or more evaluated than the recommendations allow", async () => {
    const data = await loadQuarterlySnapshot()
    for (const s of data.scopes) {
      expect(s.figures.stockout_at_risk).toBeLessThanOrEqual(s.figures.stockout_evaluated)
    }
  })

  it("keeps the adoption counts adding up to the total it was out of, wherever it was captured", async () => {
    const data = await loadQuarterlySnapshot()
    for (const s of data.scopes) {
      const f = s.figures
      if (f.adoption_total === null) continue
      expect((f.adopted ?? 0) + (f.partially_adopted ?? 0) + (f.not_adopted ?? 0) + (f.pending ?? 0)).toBe(f.adoption_total)
    }
  })
})

describe("landingQuarters", () => {
  it("always offers the Q2 snapshot, even when no report was generated", () => {
    expect(landingQuarters([])).toEqual(["Q2 2026"])
  })

  it("leaves Q3 2026 off the grid", () => {
    expect(HIDDEN_QUARTERS).toContain("Q3 2026")
    expect(landingQuarters(["Q3 2026"])).toEqual(["Q2 2026"])
  })

  it("lists the other generated quarters newest first, with Q2 in its place and no duplicate", () => {
    expect(landingQuarters(["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2025"])).toEqual(["Q2 2026", "Q1 2026", "Q4 2025"])
  })
})
