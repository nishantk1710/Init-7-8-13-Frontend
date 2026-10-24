import { describe, expect, it } from "vitest"

import { pageCountOf, pageOffset, pageSummary, pageWindow, parsePage } from "@/lib/pagination"

describe("parsePage", () => {
  it("reads a whole page number", () => {
    expect(parsePage("1")).toBe(1)
    expect(parsePage("42")).toBe(42)
    expect(parsePage(" 3 ")).toBe(3)
  })

  it("treats anything that is not a page as absent", () => {
    for (const value of [undefined, "", "0", "-2", "2.5", "abc", "1e3", ["2", "3"]]) {
      expect(parsePage(value)).toBeUndefined()
    }
  })
})

describe("pageOffset / pageCountOf", () => {
  it("offsets a 1-based page", () => {
    expect(pageOffset(1, 25)).toBe(0)
    expect(pageOffset(3, 25)).toBe(50)
  })

  it("never reports zero pages", () => {
    expect(pageCountOf(0, 25)).toBe(1)
    expect(pageCountOf(25, 25)).toBe(1)
    expect(pageCountOf(26, 25)).toBe(2)
    expect(pageCountOf(42_649, 25)).toBe(1_706)
  })
})

describe("pageWindow", () => {
  it("places a middle page in the whole list", () => {
    expect(pageWindow({ page: 2, pageSize: 25, total: 42_649, count: 25 })).toEqual({
      page: 2,
      pageCount: 1_706,
      first: 26,
      last: 50,
      hasPrevious: true,
      hasNext: true,
    })
  })

  it("stops Next on a short last page", () => {
    const w = pageWindow({ page: 1_706, pageSize: 25, total: 42_649, count: 24 })
    expect(w).toMatchObject({ first: 42_626, last: 42_649, hasNext: false })
  })

  it("keeps Next enabled on a full page when the total is unknown", () => {
    expect(pageWindow({ page: 1, pageSize: 25, total: null, count: 25 }).hasNext).toBe(true)
    expect(pageWindow({ page: 2, pageSize: 25, total: null, count: 7 }).hasNext).toBe(false)
  })

  it("shows nothing when the page is empty", () => {
    expect(pageWindow({ page: 1, pageSize: 25, total: 0, count: 0 })).toMatchObject({
      first: 0,
      last: 0,
      hasPrevious: false,
      hasNext: false,
    })
  })
})

describe("pageSummary", () => {
  it("shows the range, the total and the noun", () => {
    expect(pageSummary({ page: 6, pageSize: 5, total: 18_752, count: 5, noun: "recommendations" })).toBe(
      "Showing 26–30 of 18,752 recommendations"
    )
  })

  it("clips the last page to the rows it actually has", () => {
    expect(pageSummary({ page: 3_751, pageSize: 5, total: 18_752, count: 2 })).toBe("Showing 18,751–18,752 of 18,752")
  })

  it("leaves the total out when the backend did not send one", () => {
    expect(pageSummary({ page: 2, pageSize: 25, total: null, count: 25 })).toBe("Showing 26–50")
  })

  it("says so past the end, rather than showing a range of nothing", () => {
    expect(pageSummary({ page: 9, pageSize: 25, total: 12, count: 0 })).toBe("No rows on this page")
  })

  it("names the page that is loading instead of its range over the old rows", () => {
    expect(pageSummary({ page: 6, pageSize: 5, total: 18_752, count: 5, loading: true })).toBe("Loading page 6…")
    expect(pageSummary({ page: 1_706, pageSize: 5, total: 18_752, count: 5, loading: true })).toBe("Loading page 1,706…")
  })
})
