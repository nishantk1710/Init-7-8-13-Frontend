import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  daysPastExpected,
  departmentOptions,
  filterOverview,
  openLinesByVendor,
  overviewPdfTitle,
  repairStatusBuckets,
  stageAging,
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
      requester: "10316",
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

  it("narrows the repair lines by department, and leaves the universe alone", () => {
    // A material is not raised by a department: only its repairs are.
    const slice = filterOverview(chains, universe, { ...NO_OVERVIEW_FILTERS, department: "10316" })
    expect(slice.chains.map((c) => c.id)).toEqual(["c"])
    expect(slice.universe).toHaveLength(3)
  })

  it("keeps everything when nothing is filtered", () => {
    const slice = filterOverview(chains, universe, NO_OVERVIEW_FILTERS)
    expect(slice.chains).toHaveLength(3)
    expect(slice.universe).toHaveLength(3)
  })
})

describe("departmentOptions", () => {
  it("lists each department once, in code order, named when the list knows it", () => {
    expect(
      departmentOptions([
        chain({ requester: "10316", requesterName: "Mining" }),
        chain({ requester: "10201" }),
        chain({ requester: "10316" }),
        chain({ requester: undefined }),
      ]),
    ).toEqual([
      { value: "10201", label: "10201" },
      { value: "10316", label: "10316 · Mining" },
    ])
  })
})

describe("stageAging", () => {
  const bands = ["0-15", "16-30", "31-45", "46-60", "60+"]

  it("puts the PRs raised with no PO yet first, by days since the PR", () => {
    const aging = stageAging(
      [chain({ daysInCurrentStage: 40 }), chain({ repairStatus: "At Vendor", daysInCurrentStage: 3 })],
      bands,
      [chain({ lineKind: "PR", repairStatus: "PR Raised", overdueStatus: "NOT_ORDERED", daysInCurrentStage: 20 })],
    )
    expect(aging.rows).toEqual([
      { stage: "PR Raised", cells: [0, 1, 0, 0, 0] },
      { stage: "PO Issued", cells: [0, 0, 1, 0, 0] },
      { stage: "At Vendor", cells: [1, 0, 0, 0, 0] },
    ])
  })

  it("counts the PO lines past their expected return by days past it, and never a PR", () => {
    const aging = stageAging(
      [
        chain({ daysRemainingInRepair: -5 }),
        chain({ daysRemainingInRepair: -90 }),
        // Not past it yet, and no date at all: neither is late.
        chain({ daysRemainingInRepair: 12 }),
        chain({ daysRemainingInRepair: undefined }),
      ],
      bands,
      [chain({ lineKind: "PR", repairStatus: "PR Raised", daysRemainingInRepair: -30 })],
    )
    expect(aging.late).toEqual([1, 0, 0, 0, 1])
  })

  it("has no late row with no PO line to be late", () => {
    const aging = stageAging([], bands, [chain({ lineKind: "PR", repairStatus: "PR Raised", daysInCurrentStage: 2 })])
    expect(aging.late).toBeNull()
    expect(aging.rows.map((row) => row.stage)).toEqual(["PR Raised"])
  })
})

describe("daysPastExpected", () => {
  it("is the days past the expected return, and nothing until the date has passed", () => {
    expect(daysPastExpected({ daysRemainingInRepair: -61 })).toBe(61)
    expect(daysPastExpected({ daysRemainingInRepair: 0 })).toBeUndefined()
    expect(daysPastExpected({ daysRemainingInRepair: undefined })).toBeUndefined()
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
