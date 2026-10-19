import { describe, expect, it } from "vitest"

import type { CodingCandidate, NewItemPrice } from "@/features/initiative-8/types/repair"
import {
  matchesCandidateSearch,
  newItemPriceCell,
  newItemPriceSortValue,
  newItemPriceTitle,
  nextPriceSort,
  sortByNewItemPrice,
} from "@/features/initiative-8/utils/coding-candidates-view"
import { UNKNOWN } from "@/features/initiative-8/utils/status"

/**
 * The coding-candidate screen's price column, sort and search.
 *
 * The tests that earn their place are the ones where a wrong answer looks
 * right: a missing price shown as R 0, an unpriced row leading an ascending
 * sort, and a zero-padded SAP number that finds nothing.
 */

function candidate(materialId: string, prices: NewItemPrice[], texts: string[] = []): CodingCandidate {
  return {
    material: { materialId, materialCode: materialId, description: texts[0] ?? materialId },
    verdict: "MISCODED_REPAIRABLE",
    confidence: "high",
    reason: "",
    plants: prices.map((p) => p.plant),
    lines: [],
    distinctTexts: texts,
    twins: [],
    isCorroborated: false,
    isActionable: true,
    meetsConfidenceThreshold: true,
    inRepairableUniverse: false,
    model: "gpt-4o",
    provider: "foundry",
    newItemPrices: prices,
  }
}

const priced = (plant: string, price: number, valuationType?: string): NewItemPrice => ({
  plant,
  price,
  valuationType,
  mbewValue: price,
})

describe("newItemPriceCell", () => {
  it("shows one plant's price alone — the Plants column already names it", () => {
    expect(newItemPriceCell([priced("1300", 1222)])).toEqual([
      {
        plant: undefined,
        label: "R 1,222",
        title: "MBEW moving average price (VERPR) at plant 1300: R 1,222.00.",
      },
    ])
  })

  it("leads each line with its plant when there are two", () => {
    const lines = newItemPriceCell([
      priced("1300", 322.16),
      { plant: "1500", missing: "NOT_IN_MBEW" },
    ])

    expect(lines.map((l) => [l.plant, l.label])).toEqual([
      ["1300", "R 322"],
      ["1500", UNKNOWN],
    ])
  })

  it("never shows a missing price as R 0", () => {
    const [line] = newItemPriceCell([{ plant: "1500", missing: "TOKEN_VALUE", mbewValue: 1 }])

    expect(line.label).toBe(UNKNOWN)
  })

  it("says so when the candidate has no plant at all", () => {
    expect(newItemPriceCell([])[0].label).toBe(UNKNOWN)
  })
})

describe("newItemPriceTitle", () => {
  it("names the valuation type on a split-valuated material", () => {
    expect(newItemPriceTitle(priced("1500", 38122, "NEW"))).toBe(
      "MBEW moving average price (VERPR) at plant 1500, valuation type NEW: R 38,122.00.",
    )
  })

  it("quotes the placeholder MBEW holds", () => {
    expect(newItemPriceTitle({ plant: "1500", missing: "TOKEN_VALUE", mbewValue: 0.01 })).toBe(
      "No price: MBEW holds a placeholder value of R 0.01 at plant 1500, not a real valuation.",
    )
  })

  it("explains a split valuation with no NEW row", () => {
    expect(newItemPriceTitle({ plant: "1500", missing: "NO_NEW_VALUATION" })).toBe(
      "No price: this material is valued by condition at plant 1500, with no NEW valuation.",
    )
  })

  it("explains a material MBEW does not hold", () => {
    expect(newItemPriceTitle({ plant: "1500", missing: "NOT_IN_MBEW" })).toBe(
      "No price: this material has no MBEW valuation record at plant 1500.",
    )
  })

  it("does not blame the material when the lookup itself failed", () => {
    expect(newItemPriceTitle({ plant: "1300", missing: "LOOKUP_FAILED" })).toBe(
      "Price not available: the MBEW lookup did not answer in time. Reload the page to try again.",
    )
  })

  it("still says something true about a reason it does not know", () => {
    expect(newItemPriceTitle({ plant: "1300", missing: "SOMETHING_NEW" })).toBe(
      "No price at plant 1300 (SOMETHING_NEW).",
    )
  })
})

describe("sorting by new item price", () => {
  const cheap = candidate("A", [priced("1300", 50)])
  const dear = candidate("B", [priced("1300", 5000)])
  const unpriced = candidate("C", [{ plant: "1300", missing: "TOKEN_VALUE", mbewValue: 1 }])
  const twoPlants = candidate("D", [priced("1300", 100), priced("1500", 900)])
  const ranked = [unpriced, cheap, dear, twoPlants]

  it("sorts a two-plant candidate by its highest price", () => {
    expect(newItemPriceSortValue(twoPlants)).toBe(900)
    expect(newItemPriceSortValue(unpriced)).toBeUndefined()
  })

  it("keeps the ranking when the column is not sorted", () => {
    expect(sortByNewItemPrice(ranked, "none")).toEqual(ranked)
  })

  it("puts unpriced candidates last in both directions", () => {
    const ids = (rows: CodingCandidate[]) => rows.map((c) => c.material.materialId)

    expect(ids(sortByNewItemPrice(ranked, "desc"))).toEqual(["B", "D", "A", "C"])
    expect(ids(sortByNewItemPrice(ranked, "asc"))).toEqual(["A", "D", "B", "C"])
  })

  it("does not reorder the array it was given", () => {
    sortByNewItemPrice(ranked, "desc")
    expect(ranked.map((c) => c.material.materialId)).toEqual(["C", "A", "B", "D"])
  })

  it("cycles highest first, lowest first, back to the ranking", () => {
    expect(nextPriceSort("none")).toBe("desc")
    expect(nextPriceSort("desc")).toBe("asc")
    expect(nextPriceSort("asc")).toBe("none")
  })
})

describe("matchesCandidateSearch", () => {
  const kit = candidate("5000094118", [], ["RECONDITIONED BRAKE FOOTVALVE", "Brake valve repair kit"])

  it("matches the material number, and a zero-padded one pasted from SAP", () => {
    expect(matchesCandidateSearch(kit, "5000094118")).toBe(true)
    expect(matchesCandidateSearch(kit, "000000005000094118")).toBe(true)
    expect(matchesCandidateSearch(kit, "94118")).toBe(true)
  })

  it("matches any of the material's texts, not only the first, in any case", () => {
    expect(matchesCandidateSearch(kit, "footvalve")).toBe(true)
    expect(matchesCandidateSearch(kit, "VALVE REPAIR")).toBe(true)
  })

  it("an empty query matches everything; a miss matches nothing", () => {
    expect(matchesCandidateSearch(kit, "   ")).toBe(true)
    expect(matchesCandidateSearch(kit, "gearbox")).toBe(false)
    expect(matchesCandidateSearch(kit, "4000002023")).toBe(false)
  })
})
