import { describe, expect, it } from "vitest"

import {
  isUnfiltered,
  mergeSearchParams,
  pageHref,
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

  it("no longer carries reconciliation reference counts", () => {
    // ZMM065 and the 30-Day GR Report are read by the backend now; a stale
    // ?zmm065= link is simply ignored.
    expect(parseSearchParams({ zmm065: "5", gr30Day: "7" })).not.toHaveProperty("zmm065")
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

describe("page", () => {
  it("reads a page and ignores one that is not a page", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3)
    expect(parseSearchParams({ page: "0" }).page).toBeUndefined()
    expect(parseSearchParams({ page: "abc" }).page).toBeUndefined()
  })

  it("is not a filter", () => {
    expect(isUnfiltered(parseSearchParams({ page: "2" }))).toBe(true)
  })

  it("links to a page keeping the filters and the view", () => {
    const params = parseSearchParams({ plant: "1500", view: "grni", page: "4" })
    expect(pageHref("/oar-utilization/watch", params, 5)).toBe(
      "/oar-utilization/watch?plant=1500&view=grni&page=5"
    )
  })

  it("drops page 1 from the link, so it matches the plain screen", () => {
    const params = parseSearchParams({ plant: "1500", page: "2" })
    expect(pageHref("/oar-utilization/ledger", params, 1)).toBe("/oar-utilization/ledger?plant=1500")
    expect(pageHref("/oar-utilization/ledger", parseSearchParams({}), 1)).toBe("/oar-utilization/ledger")
  })
})
