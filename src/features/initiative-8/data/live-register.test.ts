import { describe, expect, it } from "vitest"

import { toRepairChain } from "@/features/initiative-8/data/live-register"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"
import { isRepairOverdue, vendorLabel } from "@/features/initiative-8/utils/status"
import type { ApiRepairChain } from "@/lib/api/i8"

/**
 * W5.4 — the adapter between the API and the domain type.
 *
 * The tests that earn their place here are the ones about what must NOT be
 * invented. Real data has holes the fixtures politely filled in — 1,108 of
 * 1,225 lines have no vendor name, 357 have no reorder point or new-unit lead
 * time, 63 have no agreed return date — and every one of those must survive the
 * adapter as "unknown" rather than arriving as 0 or an empty string.
 */

/** A row shaped exactly as `GET /api/i8/register` sends one. */
function apiRow(overrides: Partial<ApiRepairChain> = {}): ApiRepairChain {
  return {
    id: "4500001052-1310",
    material: {
      materialId: "8000004665",
      materialCode: "8000004665",
      description: "PUMP CASING PN:12345",
    },
    plant: { plantId: "1300", name: "Black Mountain" },
    stockOnHand: "4.000",
    reorderPoint: "2.000",
    qtyUnderRepair: "1.000",
    repairPr: { type: "PR", documentNumber: "2000028388", line: "10" },
    repairPo: { type: "PO", documentNumber: "4500001052", line: "1310" },
    vendor: "0001000123",
    vendorName: null,
    repairStatus: "PO Issued",
    receiptStatus: "Not Yet Shipped",
    overdueStatus: "OVERDUE",
    declarationStatus: "Required",
    daysOpen: 526,
    agingBucket: "60+",
    daysAtVendor: null,
    daysInCurrentStage: 526,
    daysRemainingInRepair: -500,
    raisedAt: "2025-04-07",
    poIssuedAt: "2025-04-07",
    sentToVendorAt: null,
    expectedReturn: "2025-05-07",
    receivedAt: null,
    orderedQty: "1.000",
    receivedQty: "0.000",
    unit: "EA",
    repairCost: "8914.34",
    newUnitLeadTimeDays: 31,
    itemCategory: "3",
    docType: "ZREP",
    corroboratedByDocType: true,
    hasPoHeader: true,
    deliveryCompleted: false,
    reversals: 0,
    scheduleLines: 1,
    ...overrides,
  }
}

describe("toRepairChain", () => {
  it("renames the wire's repairPr/repairPo to the domain's repairPR/repairPO", () => {
    // The one rename in the adapter. The domain type has said repairPR since
    // before the backend existed; Python's repair_pr camelCases to repairPr.
    const chain = toRepairChain(apiRow())
    expect(chain.repairPR.documentNumber).toBe("2000028388")
    expect(chain.repairPO?.documentNumber).toBe("4500001052")
  })

  it("parses decimals sent as strings", () => {
    const chain = toRepairChain(apiRow())
    expect(chain.stockOnHand).toBe(4)
    expect(chain.repairCost).toBe(8914.34)
    expect(chain.qtyUnderRepair).toBe(1)
  })

  it("keeps unknown stock as undefined, never as zero", () => {
    // Zero stock is what triggers a duplicate purchase. "We do not know" and
    // "there is none" must not render the same.
    const chain = toRepairChain(apiRow({ stockOnHand: null }))
    expect(chain.stockOnHand).toBeUndefined()
    expect(chain.stockOnHand).not.toBe(0)
  })

  it("keeps a missing reorder point undefined — 357 Gamsberg lines have none", () => {
    const chain = toRepairChain(apiRow({ reorderPoint: null }))
    expect(chain.reorderPoint).toBeUndefined()
  })

  it("keeps a missing new-unit lead time undefined rather than 0", () => {
    // MARC covers plants 1300 and 1200 only. A 0 would read as "a new one
    // arrives immediately", the strongest possible case against repairing.
    const chain = toRepairChain(apiRow({ newUnitLeadTimeDays: null }))
    expect(chain.newUnitLeadTimeDays).toBeUndefined()
  })

  it("invents no vendor name — it falls back to the code", () => {
    // Only 117 of 1,225 lines resolve to a name.
    const chain = toRepairChain(apiRow({ vendorName: null }))
    expect(chain.vendorName).toBeUndefined()
    expect(vendorLabel(chain)).toBe("0001000123")
  })

  it("says 'Unknown vendor' when there is no vendor at all", () => {
    // 455 lines have no purchase-order header in the extract.
    const chain = toRepairChain(apiRow({ vendor: null, vendorName: null }))
    expect(vendorLabel(chain)).toBe("Unknown vendor")
  })

  it("converts ISO dates to the display format the fixtures use", () => {
    const chain = toRepairChain(apiRow())
    // Not "2025-04-07" — every other row in this app renders "7 Apr 2025".
    expect(chain.raisedAt).not.toContain("-")
    expect(chain.raisedAt).toContain("2025")
  })

  it("invents no return date for the 63 lines that never had one", () => {
    const chain = toRepairChain(
      apiRow({ expectedReturn: null, daysRemainingInRepair: null, overdueStatus: "NO_DUE_DATE" }),
    )
    expect(chain.expectedReturn).toBeUndefined()
    expect(chain.daysRemainingInRepair).toBeUndefined()
    // And it must not read as comfortably on time.
    expect(isRepairOverdue(chain)).toBe(false)
    expect(chain.overdueStatus).toBe("NO_DUE_DATE")
  })

  it("carries overdueStatus through, so the UI never redoes the date maths", () => {
    expect(isRepairOverdue(toRepairChain(apiRow()))).toBe(true)
    expect(isRepairOverdue(toRepairChain(apiRow({ overdueStatus: "RECEIVED" })))).toBe(false)
  })

  it("carries the real declaration status, which W5.3 now computes", () => {
    expect(toRepairChain(apiRow({ declarationStatus: "Flagged" })).declarationStatus).toBe(
      "Flagged",
    )
  })

  it("falls back rather than crashing on a status it does not recognise", () => {
    // Guards the day one side adds a value. An unrecognised status must not go
    // through a Record<Union, Tone> lookup and take the table down.
    const chain = toRepairChain(
      apiRow({ repairStatus: "Teleported", receiptStatus: "Vaporised" } as Partial<ApiRepairChain>),
    )
    expect(chain.repairStatus).toBe("PR Raised")
    expect(chain.receiptStatus).toBe("Not Yet Shipped")
  })

  it("shows the material number when no description exists anywhere", () => {
    // Around a tenth of the series has a material-master row; some rows have no
    // description from any source. An empty cell would look like a bug.
    const chain = toRepairChain(
      apiRow({ material: { materialId: "8000000007", materialCode: "8000000007", description: null } }),
    )
    expect(chain.material.description).toBe("8000000007")
  })

  it("produces rows the register table can filter exactly like the fixtures", () => {
    // The point of the adapter: one shape, so the client-side filtering the
    // table already does keeps working untouched.
    const chain = toRepairChain(apiRow())
    const fixture = REPAIR_CHAINS[0]
    for (const key of ["id", "material", "plant", "repairStatus", "declarationStatus", "agingBucket"]) {
      expect(chain).toHaveProperty(key)
      expect(fixture).toHaveProperty(key)
    }
  })
})

describe("the default dataset mode", () => {
  it("is live when NEXT_PUBLIC_DATASET is unset", async () => {
    // Deliberately inverted from what this asserted through W5.4, when `live`
    // was an opt-in third mode and the fixture path had to stay byte-identical.
    // Initiative 8's backed screens now read the backend unconditionally, so a
    // typo in the env var must not silently serve hand-written demo numbers to
    // somebody who asked for their real ones.
    const { DATASET_MODE, USING_LIVE_DATA } = await import("@/lib/dataset-mode")
    expect(DATASET_MODE).toBe("live")
    expect(USING_LIVE_DATA).toBe(true)
  })

  it("still resolves Initiative 7's cross-initiative signal", async () => {
    // I07's recommendation page reads material 500-14892 through the RC-8002
    // fixture. No such material exists in the backend.
    //
    // This is now the load-bearing test for the fixture cleanup: Initiative 8's
    // own screens stopped reading these rows, but the cross-initiative
    // selectors did not, and deleting the fixture files would silently cost
    // somebody else's page a feature that was built to be demonstrated.
    const { getInitiative8Material360Signal } = await import(
      "@/features/initiative-8/selectors/material-360-adapter"
    )
    expect(getInitiative8Material360Signal("500-14892")).not.toBeNull()
  })
})
