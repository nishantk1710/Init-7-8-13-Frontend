import { describe, expect, it } from "vitest"

import { filterOptions, OAR_PLANTS } from "@/features/initiative-13/utils/filter-options"

describe("filterOptions", () => {
  it("keeps every plant listed when the data has been narrowed to one", () => {
    // The bug: with ?plant=1300 the rows are all 1300, and the list built from
    // them offered nothing else to switch to.
    expect(filterOptions(OAR_PLANTS, ["1300"], "1300")).toEqual(["1300", "1500"])
  })

  it("still lists every plant when the filtered result is empty", () => {
    expect(filterOptions(OAR_PLANTS, [], "1500")).toEqual(["1300", "1500"])
  })

  it("adds values outside the fixed list rather than dropping them", () => {
    expect(filterOptions(OAR_PLANTS, ["2100", "1300"], "1900")).toEqual([
      "1300",
      "1500",
      "1900",
      "2100",
    ])
  })

  it("keeps the fixed order and does not repeat values", () => {
    expect(filterOptions(["FAST", "SLOW", "NON_MOVING"], ["NON_MOVING", "NON_MOVING"], "SLOW")).toEqual([
      "FAST",
      "SLOW",
      "NON_MOVING",
    ])
  })
})
