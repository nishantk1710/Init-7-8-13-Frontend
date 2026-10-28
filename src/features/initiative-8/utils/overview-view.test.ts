import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  declarationCounts,
  filterOverview,
  openExceptionCounts,
  openExceptionSummary,
  openLinesByVendor,
  overviewPdfTitle,
  repairStatusBuckets,
  stockByPlant,
  stockLines,
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
    lineKind: "PO",
    material: { materialId: "8000004665", materialCode: "8000004665", description: "Cylinder" },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    qtyUnderRepair: 1,
    repairPR: { type: "PR", documentNumber: "2000028376" },
    repairStatus: "PO Issued",
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

  it("sums usable and damaged where the backend split them, and only there", () => {
    const result = stockByPlant([
      universeRow({ stock: 3, usable: 2, damaged: 1 }),
      universeRow({ stock: 4, usable: 4, damaged: 0 }),
      universeRow({ plantId: "1500", plantName: "Gamsberg", stock: 5 }),
    ])
    expect(result.plants).toEqual([
      { plant: "Black Mountain Mining", stock: 7, usable: 6, damaged: 1 },
      { plant: "Gamsberg", stock: 5 },
    ])
    expect(result.plants[1].usable).toBeUndefined()
  })
})

describe("stockLines", () => {
  const count = (n: number) => n.toLocaleString("en-US")

  it("names the total per plant on a backend with no split", () => {
    expect(stockLines([{ plant: "Gamsberg", stock: 572 }], count)).toEqual(["Gamsberg 572"])
  })

  it("names usable and damaged per plant when sent", () => {
    expect(
      stockLines(
        [
          { plant: "Black Mountain Mining", stock: 855, usable: 800, damaged: 55 },
          { plant: "Gamsberg", stock: 572, usable: 572 },
        ],
        count,
      ),
    ).toEqual(["Black Mountain Mining: 800 usable · 55 damaged", "Gamsberg: 572 usable"])
  })
})

describe("declarationCounts", () => {
  it("counts only Required as waiting, and the Historical lines apart", () => {
    // The card said 104 not declared while the queue said 0 waiting: it counted
    // every line not Completed, Historical ones included.
    const counts = declarationCounts([
      chain({ declarationStatus: "Historical" }),
      chain({ declarationStatus: "Historical" }),
      chain({ declarationStatus: "Required" }),
      chain({ declarationStatus: "Flagged" }),
      chain({ declarationStatus: "Completed" }),
    ])
    expect(counts).toEqual({ required: 1, historical: 2, flagged: 1 })
  })
})

describe("openExceptionCounts", () => {
  const po = chain({ id: "4500001719-10" })
  const otherPlant = chain({ id: "4500009999-10", plant: { plantId: "1500", name: "Gamsberg" } })
  const pr = chain({ id: "PR-2000028756-10", lineKind: "PR", repairStatus: "PR Raised" })
  const known = new Set([po.id, otherPlant.id, pr.id])
  const items = [
    { repairId: po.id, type: "OVERDUE_REPAIR", plantId: "1300" },
    { repairId: otherPlant.id, type: "OVERDUE_REPAIR", plantId: "1500" },
    { repairId: pr.id, type: "UNJUSTIFIED_ACQUISITION", plantId: "1300" },
    // A part declared repairable with no repair PR since: on no line.
    { repairId: undefined, type: "DECLARED_NO_REPAIR_PR", plantId: "1300" },
    { repairId: "4500000001-10", type: "DECLARED_NO_REPAIR_PR", plantId: "1500" },
  ]

  it("counts every open item the queue lists, unfiltered", () => {
    const counts = openExceptionCounts([po, otherPlant, pr], known, items, NO_OVERVIEW_FILTERS)
    expect(counts.total).toBe(5)
    expect(counts.byType).toEqual({ OVERDUE_REPAIR: 2, UNJUSTIFIED_ACQUISITION: 1, DECLARED_NO_REPAIR_PR: 2 })
  })

  it("narrows items on a line by the slice, and items on no line by plant", () => {
    const counts = openExceptionCounts([po, pr], known, items, { ...NO_OVERVIEW_FILTERS, plant: "1300" })
    expect(counts.byType).toEqual({ OVERDUE_REPAIR: 1, UNJUSTIFIED_ACQUISITION: 1, DECLARED_NO_REPAIR_PR: 1 })
  })

  it("leaves items on no line out under a vendor or criticality filter, which they cannot match", () => {
    const counts = openExceptionCounts([po], known, items, { ...NO_OVERVIEW_FILTERS, vendor: "Some vendor" })
    expect(counts.byType).toEqual({ OVERDUE_REPAIR: 1 })
  })
})

describe("openExceptionSummary", () => {
  const count = (n: number) => n.toLocaleString("en-US")

  it("names every open type with its count, most first", () => {
    expect(
      openExceptionSummary({ REPAIRED_AGAINST_ASSESSMENT: 1, OVERDUE_REPAIR: 104, DECLARED_NO_REPAIR_PR: 4 }, count),
    ).toBe("104 overdue · 4 no repair PR · 1 against the assessment")
  })

  it("names a type this build does not know by the queue's label, and skips empty ones", () => {
    expect(openExceptionSummary({ SOMETHING_NEW: 2, OVERDUE_REPAIR: 0 }, count)).toBe("2 something new")
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

describe("overviewPdfTitle", () => {
  it("dates the file by the day its figures are as at", () => {
    expect(overviewPdfTitle("2026-10-21")).toBe("i08-overview-2026-10-21")
  })

  it("still names the file when the register sent no reference date", () => {
    expect(overviewPdfTitle("")).toBe("i08-overview")
  })
})

describe("ALL", () => {
  it("is the same sentinel the register filters use", () => {
    expect(NO_OVERVIEW_FILTERS.plant).toBe(ALL)
  })
})

describe("repairStatusBuckets", () => {
  it("counts Received and Closed as one bar", () => {
    const buckets = repairStatusBuckets([
      chain({ repairStatus: "Closed" }),
      chain({ repairStatus: "Closed" }),
      chain({ repairStatus: "Received" }),
    ])

    expect(buckets).toEqual([
      { label: "Received / Closed", count: 3, color: "var(--chart-3)" },
    ])
  })

  it("drops a stage nothing is in, so no empty bar is drawn", () => {
    // The deployed shape on 13-Oct-2026: nothing at the requisition stage, and
    // nothing in the Received corner either. Three bars, not five.
    const buckets = repairStatusBuckets([
      chain({ repairStatus: "PO Issued" }),
      chain({ repairStatus: "At Vendor" }),
      chain({ repairStatus: "Closed" }),
    ])

    expect(buckets.map((b) => b.label)).toEqual([
      "PO Issued",
      "At Vendor",
      "Received / Closed",
    ])
  })

  it("keeps the lifecycle order rather than ordering by size", () => {
    const buckets = repairStatusBuckets([
      ...Array.from({ length: 9 }, () => chain({ repairStatus: "Closed" })),
      chain({ repairStatus: "PO Issued" }),
    ])

    // Closed is far bigger and still comes last: the chart reads as a journey.
    expect(buckets.map((b) => b.label)).toEqual(["PO Issued", "Received / Closed"])
  })

  it("still draws a requisition stage if one ever arrives", () => {
    // PR Raised is absent today because the register is built from PO lines,
    // not because this function excludes it.
    const buckets = repairStatusBuckets([chain({ repairStatus: "PR Raised" })])

    expect(buckets.map((b) => b.label)).toEqual(["PR Raised"])
  })
})
