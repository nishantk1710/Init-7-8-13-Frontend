import { describe, expect, it, vi } from "vitest"

import {
  declarationsHref,
  fetchAllDeclarations,
  isDeclarationFiltered,
  loadDeclarationsPage,
  parseDeclarationParams,
} from "@/features/initiative-8/data/live-declarations"

/**
 * The declaration queue pages on the server. What these pin: the counts above
 * the table describe the whole queue whatever the filters, the dropdowns are
 * not built from one page, and the export reaches every match without
 * repeating one.
 */

function item(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `DQ-${n}`,
    pr: { type: "PR", documentNumber: `100000${n}`, line: "10" },
    material: {
      materialId: `800000000${n}`,
      materialCode: `800000000${n}`,
      description: `Pump seal ${n}`,
    },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    requester: "10316",
    hasActiveRepair: true,
    relatedRepairId: `450000000${n}-10`,
    repairPo: { type: "PO", documentNumber: `450000000${n}`, line: "10" },
    vendor: "100234",
    vendorName: "Acme Rewinds",
    repairStatus: "At Vendor",
    status: "Required",
    declarationId: null,
    declaredBy: null,
    declaredAt: null,
    condition: null,
    nextAction: "Declare the condition of this part.",
    createdAt: "2026-09-01",
    ...overrides,
  }
}

const FACETS = {
  plants: [
    { plantId: "1300", name: "Black Mountain Mining" },
    { plantId: "1500", name: "Gamsberg" },
  ],
  vendors: [
    { vendor: "100999", name: null },
    { vendor: "100234", name: "Acme Rewinds" },
  ],
  repairStatuses: ["At Vendor", "Closed"],
}

function response(items: unknown[], total = items.length, extra: Record<string, unknown> = {}) {
  return {
    items,
    total,
    page: 1,
    pageSize: 25,
    referenceDate: "2026-10-18",
    meta: {
      total,
      byStatus: { Required: total },
      outstanding: total,
      attestationWindowDays: 30,
    },
    facets: FACETS,
    ...extra,
  }
}

describe("parseDeclarationParams", () => {
  it("reads the filters and the page", () => {
    expect(
      parseDeclarationParams({
        q: " seal ",
        plant: "1300",
        vendor: "100234",
        repairStatus: "At Vendor",
        page: "2",
      }),
    ).toEqual({
      filters: { q: "seal", plant: "1300", vendor: "100234", repairStatus: "At Vendor" },
      page: 2,
    })
  })

  it("treats a blank, repeated or malformed value as absent", () => {
    expect(parseDeclarationParams({ q: "  ", vendor: ["a", "b"], page: "-1" })).toEqual({
      filters: { q: undefined, plant: undefined, vendor: undefined, repairStatus: undefined },
      page: 1,
    })
  })
})

describe("declarationsHref", () => {
  it("keeps the filters and drops page 1", () => {
    expect(declarationsHref({ q: "pump seal", repairStatus: "At Vendor" }, 3)).toBe(
      "/repairable-spares/declarations?q=pump+seal&repairStatus=At+Vendor&page=3",
    )
    expect(declarationsHref({ vendor: "100234" }, 1)).toBe(
      "/repairable-spares/declarations?vendor=100234",
    )
    expect(declarationsHref({})).toBe("/repairable-spares/declarations")
  })
})

describe("isDeclarationFiltered", () => {
  it("is true for any filter, and false for none", () => {
    expect(isDeclarationFiltered({})).toBe(false)
    expect(isDeclarationFiltered({ vendor: "100234" })).toBe(true)
  })
})

describe("loadDeclarationsPage", () => {
  it("unfiltered: one request for outstanding rows, and the counts come with it", async () => {
    const fetchPage = vi.fn().mockResolvedValue(response([item(26)], 5153))

    const page = await loadDeclarationsPage({}, 2, { pageSize: 25, fetchPage })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({ outstandingOnly: true, page: 2, pageSize: 25 })
    expect(page.total).toBe(5153)
    expect(page.summary.outstanding).toBe(5153)
    expect(page.rows.map((r) => r.id)).toEqual(["DQ-26"])
  })

  it("filtered: the counts come from a request without the filters", async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation(async (query: { plant?: string }) =>
        query.plant ? response([item(1)], 1) : response([item(9)], 5153),
      )

    const page = await loadDeclarationsPage({ plant: "1500", q: "seal" }, 1, { fetchPage })

    expect(fetchPage).toHaveBeenCalledWith({
      outstandingOnly: true,
      plant: "1500",
      q: "seal",
      page: 1,
      pageSize: 25,
    })
    expect(fetchPage).toHaveBeenCalledWith({ outstandingOnly: true, pageSize: 1 })
    expect(page.rows.map((r) => r.id)).toEqual(["DQ-1"])
    expect(page.total).toBe(1)
    // "How much of the register is undeclared" must not change because
    // somebody looked at one plant.
    expect(page.summary.outstanding).toBe(5153)
  })

  it("offers every plant and vendor the server lists, a vendor by its name else its code", async () => {
    const fetchPage = vi.fn().mockResolvedValue(response([item(1)]))

    const { facets } = await loadDeclarationsPage({ plant: "1300" }, 1, { fetchPage })

    expect(facets.plants.map((p) => p.plantId)).toEqual(["1300", "1500"])
    expect(facets.vendors).toEqual([
      { value: "100999", label: "100999" },
      { value: "100234", label: "Acme Rewinds" },
    ])
    expect(facets.repairStatuses).toEqual(["At Vendor", "Closed"])
  })

  it("falls back to the page's rows when the backend sends no facets", async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      response(
        [
          item(1, { plant: { plantId: "1500", name: "Gamsberg" }, vendor: "100999", vendorName: null }),
          item(2),
        ],
        2,
        { facets: undefined },
      ),
    )

    const { facets } = await loadDeclarationsPage({}, 1, { fetchPage })

    expect(facets.plants).toEqual([
      { plantId: "1300", name: "Black Mountain Mining" },
      { plantId: "1500", name: "Gamsberg" },
    ])
    expect(facets.vendors).toEqual([
      { value: "100999", label: "100999" },
      { value: "100234", label: "Acme Rewinds" },
    ])
  })
})

describe("fetchAllDeclarations", () => {
  const batch = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => item(start + i))

  it("pages until the count is reached, outstanding rows only", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(response(batch(0, 500), 700))
      .mockResolvedValueOnce(response(batch(500, 200), 700))

    const rows = await fetchAllDeclarations({ vendor: "100234" }, fetchPage)

    expect(rows).toHaveLength(700)
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ outstandingOnly: true, vendor: "100234", page: 2, pageSize: 500 }),
    )
  })

  it("drops a repeat when a page boundary moves", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(response(batch(0, 500), 701))
      .mockResolvedValueOnce(response(batch(499, 202), 701))

    const rows = await fetchAllDeclarations({}, fetchPage)

    expect(rows).toHaveLength(701)
    expect(new Set(rows.map((r) => r.id)).size).toBe(701)
  })

  it("stops on a short page even if the count says more", async () => {
    const fetchPage = vi.fn().mockResolvedValue(response(batch(0, 3), 9000))

    expect(await fetchAllDeclarations({}, fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
