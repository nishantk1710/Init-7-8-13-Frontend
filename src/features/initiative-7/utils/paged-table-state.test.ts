// A paged table must say when the next page is loading, instead of showing the old rows under the new page number.

import { describe, expect, it } from "vitest"

import { pagedTableView } from "./paged-table-state"

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
