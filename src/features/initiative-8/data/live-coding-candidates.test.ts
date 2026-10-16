import { describe, expect, it } from "vitest"

import { toCodingCandidate } from "@/features/initiative-8/data/live-coding-candidates"
import type { ApiCodingCandidateItem } from "@/lib/api/i8"

/**
 * The coding-candidate adapter's New Item Price.
 *
 * What must NOT happen is a missing price turning into 0: on this screen R 0
 * reads as a free part, and a free part is never worth recoding.
 */

function apiItem(overrides: Partial<ApiCodingCandidateItem> = {}): ApiCodingCandidateItem {
  return {
    materialId: "5000024401",
    verdict: "CONSUMABLE_FOR_REPAIR",
    confidence: "high",
    reason: "A repair kit is a consumable used in a repair.",
    plants: ["1300", "1500"],
    lines: [],
    distinctTexts: ["REPAIR KIT HYDRAULIC CYLINDER"],
    twins: [],
    isCorroborated: false,
    isActionable: false,
    meetsConfidenceThreshold: true,
    inRepairableUniverse: false,
    model: "gpt-4o",
    provider: "foundry",
    promptVersion: 1,
    screenedAt: "2026-10-13T15:41:04Z",
    newItemPrices: [],
    ...overrides,
  }
}

describe("toCodingCandidate — new item price", () => {
  it("reads decimal strings as numbers, per plant", () => {
    const candidate = toCodingCandidate(
      apiItem({
        newItemPrices: [
          { plant: "1300", price: "322.16", valuationType: null, missing: null, mbewValue: "322.16" },
          { plant: "1500", price: "38122.00", valuationType: "NEW", missing: null, mbewValue: "38122.00" },
        ],
      }),
    )

    expect(candidate.newItemPrices).toEqual([
      { plant: "1300", price: 322.16, valuationType: undefined, missing: undefined, mbewValue: 322.16 },
      { plant: "1500", price: 38122, valuationType: "NEW", missing: undefined, mbewValue: 38122 },
    ])
  })

  it("keeps a missing price undefined, never 0, and keeps the reason", () => {
    const [price] = toCodingCandidate(
      apiItem({
        newItemPrices: [
          { plant: "1500", price: null, valuationType: null, missing: "TOKEN_VALUE", mbewValue: "1.00" },
        ],
      }),
    ).newItemPrices

    expect(price.price).toBeUndefined()
    expect(price.missing).toBe("TOKEN_VALUE")
    expect(price.mbewValue).toBe(1)
  })

  it("survives a backend that predates the column", () => {
    const legacy = apiItem()
    delete (legacy as Partial<ApiCodingCandidateItem>).newItemPrices

    expect(toCodingCandidate(legacy).newItemPrices).toEqual([])
  })
})
