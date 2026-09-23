import { describe, expect, it } from "vitest"

import {
  isUnfiltered,
  mergeSearchParams,
  parseSearchParams,
} from "@/features/initiative-13/utils/search-params"

/**
 * Filters live in the URL now, so the URL is a contract.
 *
 * Two things must hold, and both have a failure mode that only shows up on a
 * link somebody was sent rather than on a page they filtered themselves.
 */

describe("parseSearchParams", () => {
  it("reads the filters a screen uses", () => {
    expect(parseSearchParams({ plant: "1300", agingBand: "NON_MOVING" })).toMatchObject({
      plant: "1300",
      agingBand: "NON_MOVING",
    })
  })

  it("treats a repeated parameter as malformed rather than guessing", () => {
    // `?plant=1300&plant=1500` has no defensible single answer, so it gets
    // none -- the same rule the assistant's deep-link route applies.
    expect(parseSearchParams({ plant: ["1300", "1500"] }).plant).toBeUndefined()
  })

  it("drops an empty or whitespace-only value", () => {
    expect(parseSearchParams({ plant: "" }).plant).toBeUndefined()
    expect(parseSearchParams({ plant: "   " }).plant).toBeUndefined()
  })

  it("trims, so a copied link with a stray space still filters", () => {
    expect(parseSearchParams({ material: " 8000005632 " }).material).toBe("8000005632")
  })

  it("drops a negative reference count instead of sending it on", () => {
    // A negative reconciliation reference would come back as a confident
    // variance against a number nobody supplied.
    expect(parseSearchParams({ zmm065: "-1" }).zmm065).toBeUndefined()
    expect(parseSearchParams({ zmm065: "abc" }).zmm065).toBeUndefined()
  })

  it("keeps zero, which is a real reference count", () => {
    expect(parseSearchParams({ zmm065: "0" }).zmm065).toBe(0)
  })
})

describe("mergeSearchParams", () => {
  it("adds a value while keeping the others", () => {
    const merged = mergeSearchParams(new URLSearchParams("plant=1300"), {
      agingBand: "SLOW",
    })
    expect(merged).toContain("plant=1300")
    expect(merged).toContain("agingBand=SLOW")
  })

  it("removes a key when the value is cleared, rather than sending it empty", () => {
    // `?plant=` and no `plant` at all must produce the same URL. Two URLs
    // meaning one thing is how a "no results" bug that only reproduces on a
    // shared link gets made.
    expect(mergeSearchParams(new URLSearchParams("plant=1300"), { plant: "" })).toBe("")
    expect(
      mergeSearchParams(new URLSearchParams("plant=1300"), { plant: undefined })
    ).toBe("")
  })

  it("replaces rather than appending a second value for the same key", () => {
    const merged = mergeSearchParams(new URLSearchParams("plant=1300"), {
      plant: "1500",
    })
    expect(merged).toBe("plant=1500")
  })
})

describe("isUnfiltered", () => {
  it("is true only when nothing is set", () => {
    expect(isUnfiltered(parseSearchParams({}))).toBe(true)
    expect(isUnfiltered(parseSearchParams({ plant: "1300" }))).toBe(false)
  })
})
