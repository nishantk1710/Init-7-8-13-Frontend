import { describe, expect, it, vi } from "vitest"

import type { ApiJustification, JustificationListResponse } from "@/lib/api/assistant"
import {
  EXPORT_BATCH_SIZE,
  fetchAllJustifications,
  justificationsHref,
  loadJustificationsPage,
  loadMaterialDescriptions,
  parseJustificationParams,
} from "@/features/initiative-8/data/live-justifications"

/**
 * The I08 log pages on the server. What these pin: the two counts come from
 * the right requests, the dropdowns are not narrowed by the filter they
 * belong to, and the export reaches every match without repeating one.
 */

function justification(n: number, overrides: Partial<ApiJustification> = {}): ApiJustification {
  return {
    id: `J${n}`,
    sessionId: `S${n}`,
    exceptionId: null,
    kind: "NEW_ACQUISITION",
    reasonCategory: "URGENT_BREAKDOWN",
    freeText: `reason ${n}`,
    materialId: "8000004596",
    plant: "1300",
    author: "requester-1",
    recordedAt: "2026-10-14T12:00:00Z",
    ...overrides,
  }
}

function response(
  items: ApiJustification[],
  total: number,
  facets: JustificationListResponse["facets"] = { plants: ["1300", "1500"], reasonCategories: ["URGENT_BREAKDOWN"] }
): JustificationListResponse {
  return { items, total, facets, reasonCategories: [], note: "" }
}

describe("parseJustificationParams", () => {
  it("reads the filters and the page", () => {
    expect(
      parseJustificationParams({ q: " pump ", plant: "1300", reason: "URGENT_BREAKDOWN", page: "3" })
    ).toEqual({ filters: { q: "pump", plant: "1300", reason: "URGENT_BREAKDOWN" }, page: 3 })
  })

  it("treats a blank, repeated or malformed value as absent", () => {
    expect(parseJustificationParams({ q: "  ", plant: ["1300", "1500"], page: "0" })).toEqual({
      filters: { q: undefined, plant: undefined, reason: undefined },
      page: 1,
    })
  })
})

describe("justificationsHref", () => {
  it("keeps the filters and drops page 1", () => {
    expect(justificationsHref({ q: "pump seal", plant: "1300" }, 1)).toBe(
      "/repairable-spares/justifications?q=pump+seal&plant=1300"
    )
    expect(justificationsHref({ reason: "OTHER" }, 2)).toBe(
      "/repairable-spares/justifications?reason=OTHER&page=2"
    )
    expect(justificationsHref({})).toBe("/repairable-spares/justifications")
  })
})

describe("loadJustificationsPage", () => {
  it("unfiltered: one request, and the two counts are the same number", async () => {
    const fetchPage = vi.fn().mockResolvedValue(response([justification(26)], 26))

    const page = await loadJustificationsPage({}, 2, { pageSize: 25, fetchPage })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({ kind: "NEW_ACQUISITION", limit: 25, offset: 25 })
    expect(page).toMatchObject({ total: 26, overall: 26 })
  })

  it("filtered: the tile and the dropdowns come from the unfiltered request", async () => {
    const fetchPage = vi.fn(async (params?: { q?: string; plant?: string }) =>
      params?.plant
        ? response([justification(1)], 1, { plants: ["1300"], reasonCategories: ["URGENT_BREAKDOWN"] })
        : response([justification(9)], 40)
    )

    const page = await loadJustificationsPage({ plant: "1300", q: "pump" }, 1, { fetchPage })

    expect(fetchPage).toHaveBeenCalledWith({ kind: "NEW_ACQUISITION", limit: 1 })
    expect(fetchPage).toHaveBeenCalledWith({
      kind: "NEW_ACQUISITION",
      q: "pump",
      plant: "1300",
      reasonCategory: undefined,
      limit: 25,
      offset: 0,
    })
    expect(page.items.map((e) => e.id)).toEqual(["J1"])
    expect(page.total).toBe(1)
    expect(page.overall).toBe(40)
    // Choosing 1300 must not take 1500 out of the plant list.
    expect(page.facets.plants).toEqual(["1300", "1500"])
  })

  it("falls back to the rows in hand when the backend sends no facets", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      ...response([justification(1, { plant: "1500" }), justification(2)], 2),
      facets: undefined,
    })

    const page = await loadJustificationsPage({}, 1, { fetchPage })

    expect(page.facets).toEqual({ plants: ["1300", "1500"], reasonCategories: ["URGENT_BREAKDOWN"] })
  })
})

describe("fetchAllJustifications", () => {
  const batch = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => justification(start + i))

  it("pages until the count is reached", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(response(batch(0, EXPORT_BATCH_SIZE), 700))
      .mockResolvedValueOnce(response(batch(EXPORT_BATCH_SIZE, 200), 700))

    const rows = await fetchAllJustifications({ reason: "OTHER" }, fetchPage)

    expect(rows).toHaveLength(700)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ reasonCategory: "OTHER", limit: EXPORT_BATCH_SIZE, offset: EXPORT_BATCH_SIZE })
    )
  })

  it("drops the repeat a justification recorded mid-export causes", async () => {
    // One new row arrived between the requests, so the second batch starts
    // with the last row of the first.
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(response(batch(0, EXPORT_BATCH_SIZE), 701))
      .mockResolvedValueOnce(response(batch(EXPORT_BATCH_SIZE - 1, 201), 701))

    const rows = await fetchAllJustifications({}, fetchPage)

    expect(rows).toHaveLength(700)
    expect(new Set(rows.map((r) => r.id)).size).toBe(700)
  })

  it("stops on a short page even if the count says more", async () => {
    // A backend from before paging: `total` was the page length, and `offset`
    // was ignored. One request, not a loop.
    const fetchPage = vi.fn().mockResolvedValue(response(batch(0, 3), 3))

    expect(await fetchAllJustifications({}, fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

describe("loadMaterialDescriptions", () => {
  const universe = (...materials: [string, string | null][]) => ({
    items: materials.map(([materialId, description]) => ({ material: { materialId, description } })),
  })

  it("looks each distinct material up once and keeps the descriptions found", async () => {
    const lookup = vi.fn(async (id: string) =>
      id === "8000000007" ? universe(["8000000007", "BEARING ASSEMBLY"]) : universe([id, null]),
    )

    const found = await loadMaterialDescriptions(["8000000007", "8000000007", "8000004596"], lookup)

    expect(lookup).toHaveBeenCalledTimes(2)
    expect(found).toEqual({ "8000000007": "BEARING ASSEMBLY" })
  })

  it("matches a padded number to the plain one, and never another material", async () => {
    // A search for 8000000007 also finds 80000000071: only the exact one counts.
    const lookup = vi.fn(async () =>
      universe(["000000008000000071", "NOT THIS ONE"], ["000000008000000007", "BEARING ASSEMBLY"]),
    )

    expect(await loadMaterialDescriptions(["8000000007"], lookup)).toEqual({ "8000000007": "BEARING ASSEMBLY" })
  })

  it("leaves a material whose lookup fails or hangs without a description, and the rest unharmed", async () => {
    const lookup = vi.fn(async (id: string) => {
      if (id === "8000000010") throw new Error("503")
      if (id === "8000000003") return new Promise<never>(() => {})
      return universe([id, "VALVE"])
    })

    expect(await loadMaterialDescriptions(["8000000010", "8000000003", "8000004596"], lookup, 50)).toEqual({
      "8000004596": "VALVE",
    })
  })
})
