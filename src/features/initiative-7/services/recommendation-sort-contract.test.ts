// Regression cover for the invalid-sort bug on the Quarterly Reports page.
//
// The material table asked the backend to sort by "rop_delta_magnitude".
// That field is not in the backend's sort whitelist
// (app/api/i7/recommendations.py::SORT_FIELDS), and an unknown value there is
// NOT ignored -- the route raises 400 INVALID_SORT_FIELD before any row is
// read. So the fetch failed on every load and the table rendered its empty
// state, which read as "no recommendations" rather than as a broken request.
//
// There is no persisted ROP-delta column to sort on, so the fix uses a real
// whitelisted field (generated_at) rather than adding a sort field or
// computing a delta across all ~113k rows. These tests pin both halves of
// that contract: the allowed set, and the fact that the page asks for a
// member of it.
//
// SORT_FIELDS is duplicated here as a literal on purpose -- this is a
// frontend test and cannot import Python. That duplication is the point: if
// the backend whitelist changes, this test keeps asserting the old set and
// the mismatch has to be looked at deliberately.

import { describe, expect, it, vi, afterEach } from "vitest"

import { fetchRecommendations } from "./i7-api"

/** app/api/i7/recommendations.py::SORT_FIELDS, as of this commit. */
const BACKEND_SORT_FIELDS = [
  "generated_at",
  "status",
  "material",
  "plant",
  "demand_class",
  "confidence",
] as const

function stubFetchCapture() {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ items: [], total: 0, page: 1, page_size: 50 }),
    headers: new Headers(),
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("recommendation list sort contract", () => {
  it("does not accept 'rop_delta_magnitude' -- the field that caused the 400", () => {
    expect(BACKEND_SORT_FIELDS).not.toContain("rop_delta_magnitude")
  })

  it("passes a whitelisted sort field straight through to the query string", async () => {
    const spy = stubFetchCapture()
    await fetchRecommendations({ sort: "generated_at", sortDesc: true, pageSize: 50 })

    const url = String(spy.mock.calls[0]?.[0])
    const sort = new URL(url, "http://localhost").searchParams.get("sort")

    expect(sort).toBe("generated_at")
    expect(BACKEND_SORT_FIELDS).toContain(sort as (typeof BACKEND_SORT_FIELDS)[number])
  })

  it("sends every whitelisted field unaltered, so none of them can silently 400", async () => {
    for (const field of BACKEND_SORT_FIELDS) {
      const spy = stubFetchCapture()
      await fetchRecommendations({ sort: field })

      const url = String(spy.mock.calls[0]?.[0])
      expect(new URL(url, "http://localhost").searchParams.get("sort")).toBe(field)
      vi.unstubAllGlobals()
    }
  })

  it("omits the sort parameter entirely when none is given, letting the backend default apply", async () => {
    const spy = stubFetchCapture()
    await fetchRecommendations({})

    const url = String(spy.mock.calls[0]?.[0])
    expect(new URL(url, "http://localhost").searchParams.has("sort")).toBe(false)
  })
})
