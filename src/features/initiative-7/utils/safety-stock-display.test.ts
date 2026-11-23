import { describe, expect, it } from "vitest"

import type { Recommendation } from "@/features/initiative-7/types/inventory"
import {
  anyRecommendedSafetyStock,
  hasRecommendedSafetyStock,
  recHasRecommendedSafetyStock,
  safetyStockText,
} from "@/features/initiative-7/utils/safety-stock-display"
import { stockFigure } from "@/features/initiative-7/utils/stock-figure"

const rec = (over: Partial<Recommendation> = {}): Recommendation =>
  ({
    id: "R",
    current: { rop: 850, safetyStock: 650, maxStock: 1440 },
    recommended: { rop: 120, safetyStock: null, maxStock: 255 },
    ...over,
  }) as Recommendation

describe("a missing safety stock is not a zero", () => {
  it("reads null as none and a real 0 as a value", () => {
    expect(hasRecommendedSafetyStock({ safetyStock: null })).toBe(false)
    expect(hasRecommendedSafetyStock({ safetyStock: 0 })).toBe(true)
    expect(hasRecommendedSafetyStock({ safetyStock: 89 })).toBe(true)
  })

  it("prints a dash for none and the number for a figure, including 0", () => {
    expect(safetyStockText(null)).toBe("—")
    expect(safetyStockText(undefined)).toBe("—")
    expect(safetyStockText(0)).toBe("0")
    expect(safetyStockText(650)).toBe("650")
  })

  it("keeps SAP's own safety stock available as a figure while the recommendation has none", () => {
    const r = rec()
    expect(stockFigure(r, "current", "safetyStock")).toBe(650)
    expect(stockFigure(r, "recommended", "safetyStock")).toBeNull()
    expect(recHasRecommendedSafetyStock(r)).toBe(false) // SAP's figure alone is not a recommendation
  })

  it("honours `present`: a recommended 0 that the backend never sent is none, a sent 0 is a value", () => {
    const notSent = rec({
      recommended: { rop: 12, safetyStock: 0, maxStock: 60 },
      present: {
        current: { rop: true, safetyStock: true, maxStock: true },
        recommended: { rop: true, safetyStock: false, maxStock: true },
      },
    })
    const sent = rec({
      recommended: { rop: 12, safetyStock: 0, maxStock: 60 },
      present: {
        current: { rop: true, safetyStock: true, maxStock: true },
        recommended: { rop: true, safetyStock: true, maxStock: true },
      },
    })
    expect(recHasRecommendedSafetyStock(notSent)).toBe(false)
    expect(recHasRecommendedSafetyStock(sent)).toBe(true)
  })
})

describe("a safety stock column is shown only when some row has a recommendation", () => {
  it("leaves it out when none do (today's new recommendations, stock items and OAR alike)", () => {
    expect(anyRecommendedSafetyStock([rec(), rec({ id: "R2" })])).toBe(false)
    expect(anyRecommendedSafetyStock([])).toBe(false)
  })

  it("keeps it when an older recommendation still carries one", () => {
    const older = rec({ id: "R3", recommended: { rop: 120, safetyStock: 89, maxStock: 255 } })
    expect(anyRecommendedSafetyStock([rec(), older])).toBe(true)
  })
})
