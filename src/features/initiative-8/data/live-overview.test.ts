import { describe, expect, it } from "vitest"

import { toUniverseRows } from "@/features/initiative-8/data/live-overview"
import type { ApiUniverseItem } from "@/lib/api/i8"

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

  it("names a row with no plant rather than dropping it", () => {
    expect(toUniverseRows([universeRow({ plant: null })])[0]).toMatchObject({
      plantId: "",
      plantName: "Unknown plant",
    })
  })
})
