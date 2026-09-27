import { describe, expect, it } from "vitest"

import {
  buildRegisterOptions,
  registerDescription,
  toRepairChain,
} from "@/features/initiative-8/data/live-register"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"
import {
  NO_REGISTER_FILTERS,
  REGISTER_CSV_HEADERS,
  filterRegister,
  registerRowsToCsv,
} from "@/features/initiative-8/utils/register-view"
import {
  NO_CRITICALITY,
  isOpenRepair,
  isRepairOverdue,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type { ApiRegisterMeta, ApiRepairChain } from "@/lib/api/i8"

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
    leadTimeStatus: "BEYOND_LEAD_TIME",
    declarationStatus: "Required",
    daysOpen: 526,
    agingBucket: "60+",
    leadTimeDays: 31,
    daysElapsed: 526,
    daysOverLeadTime: 495,
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
    criticality: null,
    poBlocked: false,
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

describe("criticality and blocked PO lines", () => {
  it("carries a criticality rating through", () => {
    expect(toRepairChain(apiRow({ criticality: "CRITICAL" })).criticality).toBe("CRITICAL")
  })

  it("keeps an unrated line unrated — never NORMAL", () => {
    // ZMM065 rates well under half the universe. Defaulting the rest to NORMAL
    // would quietly downgrade parts nobody has assessed.
    expect(toRepairChain(apiRow({ criticality: null })).criticality).toBeUndefined()
    expect(toRepairChain(apiRow({ criticality: undefined })).criticality).toBeUndefined()
  })

  it("flags a blocked PO line and keeps it", () => {
    expect(toRepairChain(apiRow({ poBlocked: true })).poBlocked).toBe(true)
  })

  it("reads a backend that predates poBlocked as not blocked", () => {
    expect(toRepairChain(apiRow({ poBlocked: undefined })).poBlocked).toBe(false)
  })
})

describe("buildRegisterOptions", () => {
  const chains = [
    toRepairChain(apiRow({ id: "a", repairStatus: "Closed", overdueStatus: "RECEIVED", criticality: "NORMAL" })),
    toRepairChain(apiRow({ id: "b", repairStatus: "PO Issued", criticality: "CRITICAL" })),
    toRepairChain(apiRow({ id: "c", repairStatus: "Received", overdueStatus: "RECEIVED" })),
    toRepairChain(apiRow({ id: "d", repairStatus: "PO Issued", vendor: null, vendorName: null })),
  ]

  it("offers only the repair statuses the data actually has, in lifecycle order", () => {
    // Three occur in the July extract, not the six the type allows. A status
    // no row has is a filter that can only ever return nothing.
    expect(buildRegisterOptions(chains).repairStatusOptions).toEqual([
      "PO Issued",
      "Received",
      "Closed",
    ])
  })

  it("lists criticalities most severe first, with unrated lines findable last", () => {
    expect(buildRegisterOptions(chains).criticalityOptions).toEqual([
      "CRITICAL",
      "NORMAL",
      NO_CRITICALITY,
    ])
  })

  it("offers no 'Not recorded' option when every line is rated", () => {
    const rated = [toRepairChain(apiRow({ criticality: "IMPACT" }))]
    expect(buildRegisterOptions(rated).criticalityOptions).toEqual(["IMPACT"])
  })

  it("keeps lines with no vendor findable", () => {
    expect(buildRegisterOptions(chains).vendorOptions).toContain("Unknown vendor")
  })
})

describe("filterRegister", () => {
  const overdue = toRepairChain(apiRow({ id: "overdue", criticality: "CRITICAL" }))
  const onTime = toRepairChain(apiRow({ id: "on-time", overdueStatus: "ON_TIME" }))
  const noDate = toRepairChain(apiRow({ id: "no-date", overdueStatus: "NO_DUE_DATE" }))
  const back = toRepairChain(
    apiRow({ id: "back", overdueStatus: "RECEIVED", repairStatus: "Closed", criticality: "NORMAL" }),
  )
  const all = [overdue, onTime, noDate, back]
  const ids = (chains: { id: string }[]) => chains.map((c) => c.id)

  it("returns everything with no filter set", () => {
    expect(filterRegister(all, NO_REGISTER_FILTERS)).toHaveLength(4)
  })

  it("filters on the overdue status, each state separately", () => {
    expect(ids(filterRegister(all, { ...NO_REGISTER_FILTERS, overdue: "OVERDUE" }))).toEqual(["overdue"])
    // "No due date" is its own answer, not a kind of "on time".
    expect(ids(filterRegister(all, { ...NO_REGISTER_FILTERS, overdue: "NO_DUE_DATE" }))).toEqual(["no-date"])
    expect(ids(filterRegister(all, { ...NO_REGISTER_FILTERS, overdue: "ON_TIME" }))).toEqual(["on-time"])
  })

  it("filters on criticality, and 'Not recorded' finds the unrated lines", () => {
    expect(ids(filterRegister(all, { ...NO_REGISTER_FILTERS, criticality: "CRITICAL" }))).toEqual([
      "overdue",
    ])
    expect(
      ids(filterRegister(all, { ...NO_REGISTER_FILTERS, criticality: NO_CRITICALITY })),
    ).toEqual(["on-time", "no-date"])
  })

  it("combines filters with AND", () => {
    const filters = { ...NO_REGISTER_FILTERS, repairStatus: "Closed", criticality: "CRITICAL" }
    expect(filterRegister(all, filters)).toHaveLength(0)
  })
})

describe("registerRowsToCsv", () => {
  it("writes one row per filtered chain — all of them, not a page", () => {
    const chains = Array.from({ length: 120 }, (_, i) => toRepairChain(apiRow({ id: `line-${i}` })))
    const rows = registerRowsToCsv(chains)
    expect(rows).toHaveLength(120)
    for (const row of rows) expect(row).toHaveLength(REGISTER_CSV_HEADERS.length)
  })

  it("leaves unknown values empty rather than writing 0", () => {
    // A CSV cell is read without the column's caveats beside it: an exported 0
    // asserts "none" where the source only said "not recorded".
    const [row] = registerRowsToCsv([
      toRepairChain(apiRow({ stockOnHand: null, reorderPoint: null, criticality: null })),
    ])
    const cell = (header: string) => row[REGISTER_CSV_HEADERS.indexOf(header)]
    expect(cell("Stock on hand")).toBe("")
    expect(cell("Reorder point")).toBe("")
    expect(cell("Criticality")).toBe("")
  })

  it("carries the overdue status, the blocked flag and the lead-time verdict", () => {
    const [row] = registerRowsToCsv([toRepairChain(apiRow({ poBlocked: true }))])
    const cell = (header: string) => row[REGISTER_CSV_HEADERS.indexOf(header)]
    expect(cell("Overdue status")).toBe("Overdue")
    expect(cell("Blocked in SAP")).toBe("Yes")
    expect(cell("Lead-time status")).toBe("BEYOND_LEAD_TIME")
    expect(cell("Repair PO")).toBe("4500001052/1310")
  })
})

describe("overdueStatusOf and isOpenRepair", () => {
  it("uses the backend's overdue status when it sent one", () => {
    expect(overdueStatusOf(toRepairChain(apiRow({ overdueStatus: "NO_DUE_DATE" })))).toBe(
      "NO_DUE_DATE",
    )
  })

  it("counts a line reading 'Received' as back, not open", () => {
    // One live line reads Received without being Closed. `!== "Closed"` would
    // call it open and put the overview's aging chart one off the KPI.
    const chain = toRepairChain(apiRow({ repairStatus: "Received", overdueStatus: "RECEIVED" }))
    expect(isOpenRepair(chain)).toBe(false)
    expect(isOpenRepair(toRepairChain(apiRow()))).toBe(true)
  })
})

describe("registerDescription", () => {
  const meta = { totalLines: 1181, openLines: 744 } as ApiRegisterMeta

  it("says how many deleted lines were left out, and how many blocked ones kept", () => {
    const text = registerDescription({ ...meta, excludedDeletedLines: 44, blockedLines: 72 }, "2026-09-24")
    expect(text).toContain("44 lines deleted in SAP are excluded")
    expect(text).toContain("72 blocked in SAP are included and flagged")
  })

  it("says nothing about exclusions a backend does not report", () => {
    const text = registerDescription(meta, "2026-09-24")
    expect(text).not.toContain("deleted")
    expect(text).not.toContain("blocked")
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
