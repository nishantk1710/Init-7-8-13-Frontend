import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  filterOverview,
  openLinesByVendor,
  overviewSummaryRows,
  stockByPlant,
  summariseOverview,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"

/**
 * The dashboard's aggregations and FR-10 filters.
 *
 * Each aggregation replaced a sum over eight fixture chains, so the tests pin
 * what the real version must not do: count a material's stock once per repair
 * line, drop the lines with no vendor, or treat a missing stock record as
 * zero. The filter tests pin the one rule that is easy to get wrong — a vendor
 * filter must not empty the repairable universe.
 */

function chain(overrides: Partial<RepairChain> = {}): RepairChain {
  return {
    id: "4500001052-1310",
    material: { materialId: "8000004665", materialCode: "8000004665", description: "Cylinder" },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    qtyUnderRepair: 1,
    repairPR: { type: "PR", documentNumber: "2000028376" },
    repairStatus: "PO Issued",
    receiptStatus: "Not Yet Shipped",
    declarationStatus: "Required",
    overdueStatus: "OVERDUE",
    daysOpen: 535,
    agingBucket: "60+",
    raisedAt: "7 Apr 2025",
    repairCost: 8914.34,
    vendor: "400709",
    ...overrides,
  }
}

function universeRow(overrides: Partial<UniverseRow> = {}): UniverseRow {
  return {
    materialId: "8000000003",
    plantId: "1300",
    plantName: "Black Mountain Mining",
    stock: 1,
    ...overrides,
  }
}

describe("stockByPlant", () => {
  it("sums stock per plant, one universe row per material and plant", () => {
    const result = stockByPlant([
      universeRow({ stock: 4 }),
      universeRow({ stock: 2.5 }),
      universeRow({ plantId: "1500", plantName: "Gamsberg", stock: 3 }),
    ])
    expect(result.plants).toEqual([
      { plant: "Black Mountain Mining", stock: 6.5 },
      { plant: "Gamsberg", stock: 3 },
    ])
  })

  it("counts rows with no stock record separately instead of as zero", () => {
    const result = stockByPlant([universeRow({ stock: undefined }), universeRow({ stock: 0 })])
    expect(result.unknownRows).toBe(1)
    expect(result.plants).toEqual([{ plant: "Black Mountain Mining", stock: 0 }])
  })
})

describe("openLinesByVendor", () => {
  it("counts open lines only, grouping lines with no vendor", () => {
    const result = openLinesByVendor([
      chain(),
      chain({ vendor: undefined }),
      chain({ vendor: undefined }),
      // Back from the vendor -- not work in progress.
      chain({ overdueStatus: "RECEIVED", repairStatus: "Closed" }),
    ])
    expect(result.top).toEqual([
      { vendor: "Unknown vendor", count: 2 },
      { vendor: "400709", count: 1 },
    ])
  })

  it("keeps the top vendors and says how much it left out", () => {
    const chains = [
      ...Array.from({ length: 3 }, () => chain({ vendor: "A" })),
      ...Array.from({ length: 2 }, () => chain({ vendor: "B" })),
      chain({ vendor: "C" }),
      chain({ vendor: "D" }),
    ]
    const result = openLinesByVendor(chains, 2)
    expect(result.top.map((v) => v.vendor)).toEqual(["A", "B"])
    expect(result.vendorCount).toBe(4)
    expect(result.otherLines).toBe(2)
  })
})

describe("summariseOverview", () => {
  it("sums units still out, counting open lines only", () => {
    const metrics = summariseOverview({
      chains: [
        chain({ qtyUnderRepair: 2 }),
        chain({ qtyUnderRepair: 5, overdueStatus: "RECEIVED", repairStatus: "Closed" }),
      ],
      universe: [],
    })
    expect(metrics.qtyUnderRepair).toBe(2)
    expect(metrics.openLines).toBe(1)
    expect(metrics.totalLines).toBe(2)
  })

  it("counts a material once however many plants or repair lines it has", () => {
    const metrics = summariseOverview({
      chains: [chain(), chain()],
      universe: [
        universeRow(),
        universeRow({ plantId: "1500", plantName: "Gamsberg" }),
        universeRow({ materialId: "8000000009" }),
      ],
    })
    expect(metrics.universeMaterials).toBe(2)
    expect(metrics.universeRows).toBe(3)
    expect(metrics.universePlants).toBe(2)
  })

  it("does not count rows with no plant as a plant of their own", () => {
    // The deployed universe has rows the extract carries no plant for. Counting
    // them read as "3 plants" beside a universe meta that says 2.
    const metrics = summariseOverview({
      chains: [],
      universe: [universeRow(), universeRow({ plantId: "", plantName: "Unknown plant" })],
    })
    expect(metrics.universePlants).toBe(1)
  })

  it("counts a line with no agreed return date as its own state, not on time", () => {
    const metrics = summariseOverview({
      chains: [chain({ overdueStatus: "NO_DUE_DATE" }), chain({ overdueStatus: "OVERDUE" })],
      universe: [],
    })
    expect(metrics.noDueDateLines).toBe(1)
    expect(metrics.overdueLines).toBe(1)
  })
})

describe("filterOverview", () => {
  const chains = [
    chain({ id: "a", plant: { plantId: "1300", name: "Black Mountain Mining" }, vendor: "400709" }),
    chain({ id: "b", plant: { plantId: "1500", name: "Gamsberg" }, vendor: "400139" }),
    chain({
      id: "c",
      plant: { plantId: "1300", name: "Black Mountain Mining" },
      vendor: "400995",
      criticality: "CRITICAL",
    }),
  ]
  const universe = [
    universeRow({ plantId: "1300" }),
    universeRow({ plantId: "1500", plantName: "Gamsberg" }),
    universeRow({ plantId: "1300", criticality: "CRITICAL" }),
  ]

  it("narrows both the register and the universe by plant", () => {
    const slice = filterOverview(chains, universe, { ...NO_OVERVIEW_FILTERS, plant: "1500" })
    expect(slice.chains.map((c) => c.id)).toEqual(["b"])
    expect(slice.universe).toHaveLength(1)
  })

  it("leaves the universe alone under a vendor filter", () => {
    // The universe has no vendor. Narrowing it to nothing would answer
    // "how many repairable materials does this vendor hold" — which the data
    // cannot answer — with a confident zero.
    const slice = filterOverview(chains, universe, { ...NO_OVERVIEW_FILTERS, vendor: "400709" })
    expect(slice.chains.map((c) => c.id)).toEqual(["a"])
    expect(slice.universe).toHaveLength(3)
  })

  it("narrows both by criticality", () => {
    const slice = filterOverview(chains, universe, {
      ...NO_OVERVIEW_FILTERS,
      criticality: "CRITICAL",
    })
    expect(slice.chains.map((c) => c.id)).toEqual(["c"])
    expect(slice.universe).toHaveLength(1)
  })

  it("keeps everything when nothing is filtered", () => {
    const slice = filterOverview(chains, universe, NO_OVERVIEW_FILTERS)
    expect(slice.chains).toHaveLength(3)
    expect(slice.universe).toHaveLength(3)
  })
})

describe("overviewSummaryRows", () => {
  it("names the slice the figures came from, and the two that never narrow", () => {
    const metrics = summariseOverview({ chains: [chain()], universe: [universeRow()] })
    const rows = overviewSummaryRows(
      metrics,
      { plant: "Gamsberg", vendor: "All vendors", criticality: "All criticalities" },
      { referenceDate: "2026-10-12", pendingDeclarations: 5155, unjustifiedAcquisitions: 0 },
    )
    const byLabel = new Map(rows.map((r) => [String(r[0]), r[1]]))
    expect(byLabel.get("Plant filter")).toBe("Gamsberg")
    expect(byLabel.get("Vendor filter (repair lines only)")).toBe("All vendors")
    expect(byLabel.get("Pending declarations (whole register, unfiltered)")).toBe(5155)
    expect(byLabel.get("Unjustified new purchases (whole register, unfiltered)")).toBe(0)
  })

  it("exports a figure the backend could not give as words, never as a number", () => {
    const metrics = summariseOverview({ chains: [], universe: [] })
    const rows = overviewSummaryRows(
      metrics,
      { plant: "All plants", vendor: "All vendors", criticality: "All criticalities" },
      { referenceDate: "2026-10-12" },
    )
    const byLabel = new Map(rows.map((r) => [String(r[0]), r[1]]))
    expect(byLabel.get("Pending declarations (whole register, unfiltered)")).toBe("not available")
  })
})

describe("ALL", () => {
  it("is the same sentinel the register filters use", () => {
    expect(NO_OVERVIEW_FILTERS.plant).toBe(ALL)
  })
})
