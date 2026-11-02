import { describe, expect, it } from "vitest"

import { toUniverseRows, withoutRepairRequests } from "@/features/initiative-8/data/live-overview"
import { buildRegisterOptions, type LiveRegister } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { stageAging, summariseOverview, vendorRows } from "@/features/initiative-8/utils/overview-view"
import type { ApiRegisterMeta, ApiUniverseItem } from "@/lib/api/i8"

/**
 * What this module still owns after the dashboard's filters landed: adapting
 * the API's universe rows.
 *
 * The aggregations the tiles and charts are built from moved to
 * `utils/overview-view.ts`, where the filters live — see its own tests.
 */

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
    criticality: null,
    newUnitLeadTimeDays: 31,
    hasOpenRepair: false,
    openRepairLines: 0,
    qtyUnderRepair: "0",
    inMaterialMaster: false,
    ...overrides,
  }
}

describe("toUniverseRows", () => {
  it("keeps the fields the dashboard filters and sums on", () => {
    expect(toUniverseRows([universeRow({ stockOnHand: "4", criticality: "CRITICAL" })])).toEqual([
      {
        materialId: "8000000003",
        plantId: "1300",
        plantName: "Black Mountain Mining",
        criticality: "CRITICAL",
        stock: 4,
      },
    ])
  })

  it("leaves stock undefined where there is no record, rather than zero", () => {
    // A 0 here would be summed into a bar and read as "none in stock", which
    // is a different statement from "no MARD row exists".
    expect(toUniverseRows([universeRow({ stockOnHand: null })])[0].stock).toBeUndefined()
    expect(toUniverseRows([universeRow({ stockOnHand: "0" })])[0].stock).toBe(0)
  })

  it("carries usable and damaged stock when the backend splits it, and leaves them unknown when not", () => {
    const [split] = toUniverseRows([universeRow({ stockOnHand: "3", usableStock: "2.000000", damagedStock: "1.000000" })])
    expect(split).toMatchObject({ stock: 3, usable: 2, damaged: 1 })
    const [older] = toUniverseRows([universeRow()])
    expect(older.usable).toBeUndefined()
    expect(older.damaged).toBeUndefined()
  })

  it("names a row with no plant rather than dropping it", () => {
    expect(toUniverseRows([universeRow({ plant: null })])[0]).toMatchObject({
      plantId: "",
      plantName: "Unknown plant",
    })
  })
})

describe("withoutRepairRequests", () => {
  /** A repair PO line: out at a vendor, late, undeclared. */
  function poLine(overrides: Partial<RepairChain> = {}): RepairChain {
    return {
      id: "4500001052-1310",
      lineKind: "PO",
      material: { materialId: "8000004665", materialCode: "8000004665", description: "Cylinder" },
      plant: { plantId: "1300", name: "Black Mountain Mining" },
      qtyUnderRepair: 1,
      repairPR: { type: "PR", documentNumber: "2000028376", line: "10" },
      repairPO: { type: "PO", documentNumber: "4500001052", line: "1310" },
      repairStatus: "PO Issued",
      declarationStatus: "Required",
      overdueStatus: "OVERDUE",
      daysOpen: 535,
      daysInCurrentStage: 535,
      agingBucket: "60+",
      raisedAt: "2025-04-07",
      vendor: "400709",
      vendorName: "Pump Repairs",
      criticality: "CRITICAL",
      ...overrides,
    }
  }

  /** A repair requested with no PO yet, at a plant and criticality no PO line has. */
  function prLine(overrides: Partial<RepairChain> = {}): RepairChain {
    return poLine({
      id: "PR-2000029113-10",
      lineKind: "PR",
      plant: { plantId: "1400", name: "Gamsberg" },
      qtyUnderRepair: 3,
      repairPR: { type: "PR", documentNumber: "2000029113", line: "10" },
      repairPO: undefined,
      repairStatus: "PR Raised",
      overdueStatus: "NOT_ORDERED",
      daysOpen: 12,
      daysInCurrentStage: 12,
      agingBucket: "0-15",
      vendor: undefined,
      vendorName: undefined,
      criticality: "IMPACT",
      ...overrides,
    })
  }

  function register(chains: RepairChain[]): LiveRegister {
    return {
      chains,
      ...buildRegisterOptions(chains),
      agingBands: ["0-15", "16-30", "31-45", "46-60", "60+"],
      meta: { openLines: 2, totalLines: 2, openRepairRequests: 1 } as ApiRegisterMeta,
      referenceDate: "2026-06-09",
      sourceLoadedAt: null,
      repairRequestsEnabled: true,
      completeFlowEnabled: true,
    }
  }

  it("leaves PR rows out of every Overview figure", () => {
    const live = withoutRepairRequests(
      register([poLine(), poLine({ id: "4500001052-1320", overdueStatus: "ON_TIME" }), prLine()]),
    )
    expect(live.chains.map((c) => c.id)).toEqual(["4500001052-1310", "4500001052-1320"])

    const metrics = summariseOverview({ chains: live.chains, universe: [] })
    expect(metrics.openLines).toBe(2)
    expect(metrics.totalLines).toBe(2)
    expect(metrics.qtyUnderRepair).toBe(2)
    expect(metrics.overdueLines).toBe(1)
    expect(live.chains.filter((c) => c.declarationStatus !== "Completed")).toHaveLength(2)
    expect(vendorRows(live.chains).map((row) => row.code)).toEqual(["400709"])
    expect(stageAging(live.chains, live.agingBands).rows.map((row) => row.stage)).toEqual(["PO Issued"])
  })

  it("rebuilds the filter choices from the PO lines alone", () => {
    const live = withoutRepairRequests(register([poLine(), prLine()]))
    expect(live.plantOptions.map((p) => p.plantId)).toEqual(["1300"])
    expect(live.vendorOptions).toEqual(["Pump Repairs"])
    expect(live.criticalityOptions).toEqual(["CRITICAL"])
    expect(live.repairStatusOptions).toEqual(["PO Issued"])
  })

  it("takes out a row with no PO even when an older backend did not mark it", () => {
    const live = withoutRepairRequests(register([poLine(), prLine({ lineKind: "PO" })]))
    expect(live.chains).toHaveLength(1)
  })

  it("keeps meta and the switch for the page's note", () => {
    const before = register([poLine(), prLine()])
    const live = withoutRepairRequests(before)
    expect(live.meta).toBe(before.meta)
    expect(live.repairRequestsEnabled).toBe(true)
  })

  it("hands a register with no PR rows back untouched", () => {
    const before = register([poLine()])
    expect(withoutRepairRequests(before)).toBe(before)
  })
})
