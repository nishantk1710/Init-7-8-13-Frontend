// A paged table must say when the next page is loading, instead of showing the old rows under the new page number.

import { describe, expect, it } from "vitest"

import { canGoNext, canGoPrevious, pagedFooterText, pagedTableView } from "./paged-table-state"

describe("pagedTableView", () => {
  it("shows a skeleton on the very first load, never 'no recommendations'", () => {
    expect(pagedTableView(true, null)).toBe("skeleton")
    expect(pagedTableView(true, [])).toBe("skeleton")
  })

  it("keeps showing the rows it has while the next page loads", () => {
    expect(pagedTableView(true, [{ id: 1 }])).toBe("rows")
  })

  it("shows the rows once loaded", () => {
    expect(pagedTableView(false, [{ id: 1 }])).toBe("rows")
  })

  it("is empty only when it has finished loading and there is nothing", () => {
    expect(pagedTableView(false, [])).toBe("empty")
    expect(pagedTableView(false, null)).toBe("empty")
  })
})

describe("pagedFooterText", () => {
  it("names the page that is loading instead of showing its range over the old rows", () => {
    expect(pagedFooterText({ loading: true, page: 6, pageSize: 5, total: 18752 })).toBe("Loading page 6…")
  })

  it("shows the range and the total once loaded", () => {
    expect(pagedFooterText({ loading: false, page: 6, pageSize: 5, total: 18752 })).toBe("Showing 26–30 of 18,752")
  })

  it("clips the last page to the total", () => {
    expect(pagedFooterText({ loading: false, page: 3751, pageSize: 5, total: 18752 })).toBe("Showing 18,751–18,752 of 18,752")
  })

  it("says 0–0 for an empty set", () => {
    expect(pagedFooterText({ loading: false, page: 1, pageSize: 5, total: 0 })).toBe("Showing 0–0 of 0")
  })
})

describe("Previous and Next", () => {
  it("are both off while a page loads, so clicks cannot pile up requests", () => {
    expect(canGoPrevious(true, 6)).toBe(false)
    expect(canGoNext(true, 6, 5, 18752)).toBe(false)
  })

  it("follow the page bounds when idle", () => {
    expect(canGoPrevious(false, 1)).toBe(false)
    expect(canGoPrevious(false, 2)).toBe(true)
    expect(canGoNext(false, 3751, 5, 18752)).toBe(false)
    expect(canGoNext(false, 3750, 5, 18752)).toBe(true)
  })
})
