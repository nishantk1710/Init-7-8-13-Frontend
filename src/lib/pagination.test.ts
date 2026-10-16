import { describe, expect, it } from "vitest"

import { pageCountOf, pageOffset, pageWindow, parsePage } from "@/lib/pagination"

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
