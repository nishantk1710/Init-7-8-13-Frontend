import { describe, expect, it } from "vitest"

import {
  openLinesByVendor,
  quantityUnderRepair,
  stockByPlant,
  unjustifiedAcquisitions,
} from "@/features/initiative-8/data/live-overview"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { ApiUniverseItem } from "@/lib/api/i8"

/**
 * The overview's aggregations. Each one replaced a sum over eight fixture
 * chains, so the tests pin what the real version must not do: count a
 * material's stock once per repair line, drop the lines with no vendor, or
 * report a check that never ran as zero findings.
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

function universeRow(overrides: Partial<ApiUniverseItem> = {}): ApiUniverseItem {
  return {
    id: "8000000003-1300",
    material: { materialId: "8000000003", materialCode: "8000000003", description: null },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    materialType: null,
    stockOnHand: "1",
    storageLocations: 2,
    reorderPoint: "0",
    mrpType: null,
    newUnitLeadTimeDays: 31,
    criticality: null,
    hasOpenRepair: false,
    openRepairLines: 0,
    qtyUnderRepair: "0",
    inMaterialMaster: false,
    ...overrides,
  }
}

describe("stockByPlant", () => {
  it("sums stock per plant, one universe row per material and plant", () => {
    const result = stockByPlant([
      universeRow({ stockOnHand: "4" }),
      universeRow({ stockOnHand: "2.5" }),
      universeRow({ plant: { plantId: "1500", name: "Gamsberg" }, stockOnHand: "3" }),
    ])
    expect(result.plants).toEqual([
      { plant: "Black Mountain Mining", stock: 6.5 },
      { plant: "Gamsberg", stock: 3 },
    ])
  })

  it("counts rows with no stock record separately instead of as zero", () => {
    const result = stockByPlant([universeRow({ stockOnHand: null }), universeRow({ stockOnHand: "0" })])
    expect(result.unknownRows).toBe(1)
    expect(result.plants).toEqual([{ plant: "Black Mountain Mining", stock: 0 }])
  })

  it("draws no empty bar for rows that have no plant and no stock", () => {
    const result = stockByPlant([universeRow({ plant: null, stockOnHand: null })])
    expect(result.plants).toEqual([])
    expect(result.unknownRows).toBe(1)
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

describe("quantityUnderRepair", () => {
  it("sums units still out", () => {
    expect(quantityUnderRepair([chain({ qtyUnderRepair: 2 }), chain({ qtyUnderRepair: 0 })])).toBe(2)
  })
})

describe("unjustifiedAcquisitions", () => {
  it("is unknown — not zero — when the backend does not run the check", () => {
    expect(
      unjustifiedAcquisitions({ byType: { MISSING_ATTESTATION: 1181 }, typesRaised: ["MISSING_ATTESTATION"] }),
    ).toBeUndefined()
  })

  it("is zero when the check runs and finds nothing", () => {
    expect(
      unjustifiedAcquisitions({
        byType: { MISSING_ATTESTATION: 1181 },
        typesRaised: ["MISSING_ATTESTATION", "UNJUSTIFIED_ACQUISITION"],
      }),
    ).toBe(0)
  })

  it("reads the count when there is one", () => {
    expect(
      unjustifiedAcquisitions({
        byType: { UNJUSTIFIED_ACQUISITION: 7 },
        typesRaised: ["UNJUSTIFIED_ACQUISITION"],
      }),
    ).toBe(7)
  })
})
