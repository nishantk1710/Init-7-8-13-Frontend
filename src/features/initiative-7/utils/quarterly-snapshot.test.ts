import { describe, expect, it } from "vitest"

import {
  ADOPTION_ZERO,
  displayStatusCounts,
  EMPTY_FILTER,
  filterMaterials,
  formatPercent,
  formatZar,
  loadQuarterlySnapshot,
  materialsCsv,
  meanParams,
  pageCount,
  pageOf,
  riskDistribution,
  SNAPSHOT_QUARTER,
  toggled,
  type SnapshotMaterial,
} from "./quarterly-snapshot"

function material(overrides: Partial<SnapshotMaterial> = {}): SnapshotMaterial {
  return {
    matnr: "5000078071",
    desc: "SAG MILL LINER",
    plant: "Gamsberg",
    circuit: "Other / plant-wide",
    crit: "CRITICAL",
    pattern: "Lumpy",
    risk: "Critical",
    stock: 5,
    uom: "EA",
    lt: 60,
    ss_cur: 0,
    ss_rec: 10,
    rop_cur: 2,
    rop_rec: 12,
    max_cur: 4,
    max_rec: 20,
    price: 100,
    wc: 1000,
    status: "Pending Review",
    ...overrides,
  }
}

describe("displayStatusCounts", () => {
  it("keeps Pending Review as counted and shows every other status at 0", () => {
    const counts = displayStatusCounts({
      "Pending Review": 858,
      Approved: 245,
      Implemented: 215,
      Returned: 138,
      Rejected: 77,
    })
    expect(counts).toEqual([
      { status: "Pending Review", count: 858 },
      { status: "Approved", count: 0 },
      { status: "Implemented", count: 0 },
      { status: "Returned", count: 0 },
      { status: "Rejected", count: 0 },
    ])
  })

  it("lists all five statuses even when Pending Review is missing", () => {
    expect(displayStatusCounts({})).toHaveLength(5)
    expect(displayStatusCounts({})[0]).toEqual({ status: "Pending Review", count: 0 })
  })
})

describe("SAP adoption", () => {
  it("is 0 across the board", () => {
    expect(ADOPTION_ZERO.map((a) => a.count)).toEqual([0, 0, 0])
    expect(ADOPTION_ZERO.map((a) => a.label)).toEqual(["Adopted", "Partial", "Not adopted"])
  })
})

describe("riskDistribution", () => {
  it("returns the four levels in order with their share of the total", () => {
    const dist = riskDistribution({ Critical: 1, High: 1, Medium: 1, Low: 1 })
    expect(dist.map((d) => d.level)).toEqual(["Critical", "High", "Medium", "Low"])
    expect(dist.every((d) => d.share === 25)).toBe(true)
  })

  it("does not divide by zero", () => {
    expect(riskDistribution({}).every((d) => d.share === 0)).toBe(true)
  })
})

describe("filterMaterials", () => {
  const rows = [
    material({ matnr: "5000078071", desc: "SAG MILL LINER", plant: "Gamsberg" }),
    material({ matnr: "8000005643", desc: "TRANSMISSION TRACTION", plant: "Black Mountain" }),
  ]

  it("matches the description, case-insensitively", () => {
    expect(filterMaterials(rows, { ...EMPTY_FILTER, query: "sag mill" }).map((r) => r.matnr)).toEqual(["5000078071"])
  })

  it("matches the material number", () => {
    expect(filterMaterials(rows, { ...EMPTY_FILTER, query: "8000005643" })).toHaveLength(1)
  })

  it("filters by plant", () => {
    expect(filterMaterials(rows, { ...EMPTY_FILTER, plant: "Black Mountain" })).toHaveLength(1)
  })

  it("filters by the risk level a chart segment was clicked on", () => {
    const mixed = [material({ risk: "Critical" }), material({ risk: "High" }), material({ risk: "High" })]
    expect(filterMaterials(mixed, { ...EMPTY_FILTER, risk: "High" })).toHaveLength(2)
  })

  it("filters by the status a chart slice was clicked on", () => {
    const mixed = [material({ status: "Pending Review" }), material({ status: "Approved" })]
    expect(filterMaterials(mixed, { ...EMPTY_FILTER, status: "Pending Review" })).toHaveLength(1)
  })

  it("combines chart, plant and text filters", () => {
    const mixed = [
      material({ risk: "High", plant: "Gamsberg", desc: "PUMP" }),
      material({ risk: "High", plant: "Black Mountain", desc: "PUMP" }),
      material({ risk: "Low", plant: "Gamsberg", desc: "PUMP" }),
    ]
    expect(filterMaterials(mixed, { query: "pump", plant: "Gamsberg", risk: "High", status: "" })).toHaveLength(1)
  })

  it("returns everything with no filter", () => {
    expect(filterMaterials(rows, { ...EMPTY_FILTER, query: "  " })).toHaveLength(2)
  })
})

describe("toggled", () => {
  it("selects, switches and clears", () => {
    expect(toggled("", "High")).toBe("High")
    expect(toggled("High", "Low")).toBe("Low")
    expect(toggled("High", "High")).toBe("")
  })
})

describe("paging", () => {
  it("slices a page and counts pages, never fewer than one", () => {
    const rows = Array.from({ length: 12 }, (_, i) => i)
    expect(pageOf(rows, 1, 5)).toEqual([0, 1, 2, 3, 4])
    expect(pageOf(rows, 3, 5)).toEqual([10, 11])
    expect(pageCount(12, 5)).toBe(3)
    expect(pageCount(0, 5)).toBe(1)
  })
})

describe("meanParams", () => {
  it("averages current and recommended and reports the change", () => {
    const [ss, rop, max] = meanParams([
      material({ ss_cur: 0, ss_rec: 10, rop_cur: 10, rop_rec: 20, max_cur: 0, max_rec: 30 }),
      material({ ss_cur: 0, ss_rec: 20, rop_cur: 20, rop_rec: 20, max_cur: 10, max_rec: 30 }),
    ])
    expect(ss).toMatchObject({ label: "Safety stock", current: 0, recommended: 15, delta: 15 })
    expect(rop).toMatchObject({ label: "Reorder point", current: 15, recommended: 20, delta: 5 })
    expect(max).toMatchObject({ label: "Maximum stock", current: 5, recommended: 30, delta: 25 })
  })

  it("gives zeros, not NaN, for no rows", () => {
    for (const row of meanParams([])) expect(row.recommended).toBe(0)
  })
})

describe("formatting", () => {
  it("formats rand amounts", () => {
    expect(formatZar(32586320.34)).toBe("R 32.59M")
    expect(formatZar(-1316009)).toBe("–R 1.32M")
    // Thousands are grouped with a locale space, which differs by platform: match any whitespace.
    expect(formatZar(-316009)).toMatch(/^–R 316\s009$/)
    expect(formatZar(250)).toBe("R 250")
  })

  it("formats a share", () => {
    expect(formatPercent(858, 1533)).toBe("56.0%")
    expect(formatPercent(1, 0)).toBe("0.0%")
  })
})

describe("materialsCsv", () => {
  it("writes a header and one quoted row per material, doubling embedded quotes", () => {
    const csv = materialsCsv([material({ desc: 'PIPE 6" (150MM)' })])
    const [head, row] = csv.split("\n")
    expect(head.startsWith('"Material","Description"')).toBe(true)
    expect(row).toContain('"PIPE 6"" (150MM)"')
  })
})

describe("the Q2 snapshot data", () => {
  it("loads, and is the quarter it says it is", async () => {
    const snapshot = await loadQuarterlySnapshot()
    expect(snapshot.quarter).toBe(SNAPSHOT_QUARTER)
    expect(snapshot.materials).toHaveLength(snapshot.recs)
  })

  it("carries a status count that adds up to the recommendations", async () => {
    const snapshot = await loadQuarterlySnapshot()
    const total = Object.values(snapshot.status).reduce((a, b) => a + b, 0)
    expect(total).toBe(snapshot.recs)
  })
})
