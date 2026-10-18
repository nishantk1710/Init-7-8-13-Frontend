import { describe, expect, it, vi } from "vitest"

import {
  activeRegisterFilters,
  buildRegisterOptions,
  fetchAllRegisterLines,
  isListedInRegister,
  loadRegisterPage,
  parseRegisterParams,
  registerDescription,
  registerHref,
  toRegisterLine,
  toRepairChain,
} from "@/features/initiative-8/data/live-register"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"
import {
  REGISTER_CSV_HEADERS,
  registerRowsToCsv,
} from "@/features/initiative-8/utils/register-view"
import {
  NO_CRITICALITY,
  isOpenRepair,
  isRepairOverdue,
  justificationCellOf,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type {
  ApiRegisterMeta,
  ApiRegisterPage,
  ApiRepairChain,
  ApiRepairJustification,
} from "@/lib/api/i8"

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

  it("keeps a missing repair cost as undefined, never as R 0.00", () => {
    // A zero would render as a free repair. No price on the line is "not
    // known", and the detail page says so.
    const chain = toRepairChain(apiRow({ repairCost: null }))
    expect(chain.repairCost).toBeUndefined()
  })

  it("does not accept In Transit Return, which is not an FRS stage", () => {
    const chain = toRepairChain(
      apiRow({ repairStatus: "In Transit Return" } as Partial<ApiRepairChain>),
    )
    expect(chain.repairStatus).toBe("PR Raised")
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
    // The July MARC extract has rows for plant 1300 only. A 0 would read as "a new one
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

/**
 * The Register screen pages on the server. What these pin: the URL reads back
 * as the filters it was written from, the listing's own two parameters go on
 * every request, the dropdowns are the server's in the order the screen always
 * had them, and each line's exceptions arrive with it. The filters themselves
 * run in the backend and are tested there (`tests/test_i8_queue_paging.py`).
 */

describe("parseRegisterParams and registerHref", () => {
  it("read every filter and the page", () => {
    expect(
      parseRegisterParams({
        q: " pump ",
        plant: "1300",
        vendor: "none",
        repairStatus: "PO Issued",
        overdue: "OVERDUE",
        criticality: "CRITICAL",
        declarationStatus: "Required",
        aging: "60+",
        exceptions: "1",
        page: "4",
      }),
    ).toEqual({
      filters: {
        q: "pump",
        plant: "1300",
        vendor: "none",
        repairStatus: "PO Issued",
        overdue: "OVERDUE",
        criticality: "CRITICAL",
        declarationStatus: "Required",
        aging: "60+",
        exceptions: true,
      },
      page: 4,
    })
  })

  it("treat a blank, repeated or malformed value as absent", () => {
    expect(
      parseRegisterParams({ q: " ", plant: ["1300", "1500"], exceptions: "yes", page: "x" }),
    ).toEqual({ filters: { exceptions: false }, page: 1 })
  })

  it("link to a page, keeping the filters and dropping page 1", () => {
    expect(registerHref({ q: "pump seal", exceptions: true }, 2)).toBe(
      "/repairable-spares/repair-register?q=pump+seal&exceptions=1&page=2",
    )
    expect(registerHref({})).toBe("/repairable-spares/repair-register")
  })

  it("read back as the same filters", () => {
    const filters = {
      q: "pump",
      plant: "1300",
      vendor: "none",
      repairStatus: "At Vendor",
      overdue: "NO_DUE_DATE",
      criticality: "none",
      declarationStatus: "Flagged",
      aging: "0-15",
      exceptions: true,
    }
    const raw = Object.fromEntries(new URL(registerHref(filters, 3), "http://x").searchParams)

    expect(parseRegisterParams(raw)).toEqual({ filters, page: 3 })
  })
})

describe("activeRegisterFilters", () => {
  it("counts each filter set, and the exceptions switch only when it is on", () => {
    expect(activeRegisterFilters({ exceptions: false })).toBe(0)
    expect(activeRegisterFilters({ q: "pump", plant: "1300", exceptions: true })).toBe(3)
  })
})

/** A `GET /api/i8/register` page as the backend sends it. */
function registerPage(
  items: ApiRepairChain[],
  extra: Partial<ApiRegisterPage> = {},
): ApiRegisterPage {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    referenceDate: "2026-10-18",
    meta: { totalLines: 5063, openLines: 735, heldLines: 92 } as ApiRegisterMeta,
    ...extra,
  }
}

describe("loadRegisterPage", () => {
  const fetchSnapshot = vi.fn().mockResolvedValue({
    rules: { agingBands: "0-15,16-30" },
    sourceLoadedAt: "2026-10-18T03:40:00Z",
  })

  it("asks for one page, with the listing's own two parameters always on", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage([apiRow()]))

    await loadRegisterPage({ plant: "1300", q: "pump", exceptions: true }, 3, {
      pageSize: 25,
      fetchPage,
      fetchSnapshot,
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({
      q: "pump",
      plant: "1300",
      withExceptions: true,
      excludeHeld: true,
      excludeExceptionType: "UNJUSTIFIED_ACQUISITION",
      page: 3,
      pageSize: 25,
    })
  })

  it("counts every match, and keeps the listed register's counts for the caption", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage([apiRow()], { total: 240 }))

    const page = await loadRegisterPage({}, 1, { fetchPage, fetchSnapshot })

    expect(page.total).toBe(240)
    expect(page.meta.heldLines).toBe(92)
    expect(page.agingBands).toEqual(["0-15", "16-30"])
    expect(page.sourceLoadedAt).toBe("2026-10-18T03:40:00Z")
  })

  it("orders the server's dropdown values the way the screen always had them", async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      registerPage([apiRow()], {
        facets: {
          plants: [
            { plantId: "1500", name: "Gamsberg" },
            { plantId: "1300", name: "Black Mountain Mining" },
          ],
          vendors: [
            { vendor: "100999", name: null },
            { vendor: "100234", name: "Acme Rewinds" },
          ],
          hasUnknownVendor: true,
          repairStatuses: ["Closed", "At Vendor", "PO Issued"],
          criticalities: ["NORMAL", "CRITICAL"],
          hasUnrated: true,
        },
      }),
    )

    const { facets } = await loadRegisterPage({}, 1, { fetchPage, fetchSnapshot })

    expect(facets.plants.map((p) => p.name)).toEqual(["Black Mountain Mining", "Gamsberg"])
    // "Unknown vendor" and "Not recorded" keep the lines with neither findable.
    expect(facets.vendors).toEqual([
      { value: "100999", label: "100999" },
      { value: "100234", label: "Acme Rewinds" },
      { value: "none", label: "Unknown vendor" },
    ])
    expect(facets.repairStatuses).toEqual(["PO Issued", "At Vendor", "Closed"])
    expect(facets.criticalities).toEqual([
      { value: "CRITICAL", label: "CRITICAL" },
      { value: "NORMAL", label: "NORMAL" },
      { value: "none", label: "Not recorded" },
    ])
  })

  it("falls back to the page's rows when the backend sends no facets", async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      registerPage([
        apiRow({ id: "a", criticality: "CRITICAL" }),
        apiRow({ id: "b", vendor: null, vendorName: null, criticality: null }),
      ]),
    )

    const { facets } = await loadRegisterPage({}, 1, { fetchPage, fetchSnapshot })

    expect(facets.vendors).toEqual([
      { value: "0001000123", label: "0001000123" },
      { value: "none", label: "Unknown vendor" },
    ])
    expect(facets.criticalities.map((c) => c.value)).toEqual(["CRITICAL", "none"])
  })

  it("brings each line's exceptions with it, and leaves 'not computed' undefined", async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      registerPage([
        apiRow({
          id: "raised",
          exceptions: [{ id: "EX-1", type: "MISSING_ATTESTATION", severity: "warning" }],
        }),
        apiRow({ id: "clean", exceptions: [] }),
        // A backend older than paging sends none: the column says "Not checked".
        apiRow({ id: "unknown" }),
      ]),
    )

    const { chains } = await loadRegisterPage({}, 1, { fetchPage, fetchSnapshot })

    expect(chains.map((c) => c.exceptions)).toEqual([
      [{ id: "EX-1", type: "MISSING_ATTESTATION", severity: "warning" }],
      [],
      undefined,
    ])
  })
})

describe("toRegisterLine", () => {
  it("carries the line's exceptions, which toRepairChain leaves off for the Overview", () => {
    const row = apiRow({
      exceptions: [{ id: "EX-1", type: "OVERDUE_REPAIR", severity: "critical" }],
    })

    expect(toRegisterLine(row).exceptions).toEqual([
      { id: "EX-1", type: "OVERDUE_REPAIR", severity: "critical" },
    ])
    // Its charts never read them, and every line it loads would carry them.
    expect(toRepairChain(row).exceptions).toBeUndefined()
  })
})

describe("fetchAllRegisterLines", () => {
  const batch = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => apiRow({ id: `L${start + i}` }))

  it("pages until the count is reached, with the screen's filters", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(registerPage(batch(0, 500), { total: 700 }))
      .mockResolvedValueOnce(registerPage(batch(500, 200), { total: 700 }))

    const chains = await fetchAllRegisterLines({ vendor: "none" }, fetchPage)

    expect(chains).toHaveLength(700)
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ vendor: "none", excludeHeld: true, page: 2, pageSize: 500 }),
    )
  })

  it("stops on a short page even if the count says more", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage(batch(0, 3), { total: 9000 }))

    expect(await fetchAllRegisterLines({}, fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

describe("toRepairChain: what the Declaration Queue and Justifications screens showed", () => {
  // Folded into the register on 08-Oct-2026, so it travels on the line.
  const recorded: ApiRepairJustification = {
    status: "RECORDED",
    entries: [
      {
        id: "J-1",
        reasonCategory: "URGENT_BREAKDOWN",
        freeText: "Line down.",
        author: "T. Mokoena",
        recordedAt: "2026-10-08T09:30:00Z",
        sessionId: "S-1",
      },
    ],
    unjustifiedPurchases: [],
  }

  it("carries who declared, when, the condition, the next action and the requester", () => {
    const chain = toRepairChain(
      apiRow({
        declarationStatus: "Flagged",
        declaredBy: "R. Kruger",
        declaredAt: "2026-09-12T09:30:00Z",
        condition: "Scrap",
        nextAction: "Assessed as Scrap but sent for repair anyway.",
        requester: "TMOKOENA",
      }),
    )
    expect(chain.declaredBy).toBe("R. Kruger")
    // A display date, not the ISO timestamp.
    expect(chain.declaredAt).toContain("2026")
    expect(chain.declaredAt).not.toContain("T")
    expect(chain.condition).toBe("Scrap")
    expect(chain.declarationNextAction).toBe("Assessed as Scrap but sent for repair anyway.")
    expect(chain.requester).toBe("TMOKOENA")
  })

  it("reads an unrecognised condition as not recorded, never as Repairable", () => {
    const chain = toRepairChain(
      apiRow({ condition: "Mostly fine" } as unknown as Partial<ApiRepairChain>),
    )
    expect(chain.condition).toBeUndefined()
  })

  it("leaves everything undefined when no attestation or justification exists", () => {
    // Also what an older backend, which sends none of these fields, produces.
    const chain = toRepairChain(apiRow())
    expect(chain.declaredBy).toBeUndefined()
    expect(chain.declaredAt).toBeUndefined()
    expect(chain.condition).toBeUndefined()
    expect(chain.justification).toBeUndefined()
    expect(justificationCellOf(chain)).toBe("NONE")
  })

  it("carries a recorded justification, newest first, with its session", () => {
    const chain = toRepairChain(apiRow({ justification: recorded }))
    expect(justificationCellOf(chain)).toBe("RECORDED")
    const [entry] = chain.justification!.entries
    expect(entry.reasonCategory).toBe("URGENT_BREAKDOWN")
    expect(entry.sessionId).toBe("S-1")
    expect(entry.recordedAt).toContain("2026")
  })

  it("reads a purchase with no reason as Missing, and one nobody was asked about as Not asked", () => {
    const purchase = {
      exceptionId: "EX-UNJUSTIFIED_ACQUISITION-4100100001-10",
      purchase: { type: "PO" as const, documentNumber: "4100100001", line: "10" },
      raisedAt: "2026-05-10",
      preAutomation: false,
    }
    const missing = toRepairChain(
      apiRow({
        justification: { status: "MISSING", entries: [], unjustifiedPurchases: [purchase] },
      }),
    )
    expect(justificationCellOf(missing)).toBe("MISSING")
    expect(missing.justification!.unjustifiedPurchases[0].purchase.documentNumber).toBe(
      "4100100001",
    )

    const notAsked = toRepairChain(
      apiRow({
        justification: {
          status: "MISSING",
          entries: [],
          unjustifiedPurchases: [{ ...purchase, preAutomation: true }],
        },
      }),
    )
    expect(justificationCellOf(notAsked)).toBe("NOT_ASKED")
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
    // The label the screen shows, matching the overdue column beside it --
    // not the raw enum.
    expect(cell("Lead-time status")).toBe("Beyond")
    expect(cell("Repair PO")).toBe("4500001052/1310")
  })

  it("exports no lead-time verdict where there is no benchmark", () => {
    // An empty cell, never "NO_LEAD_TIME": a spreadsheet filter would otherwise
    // group every unmaintained material in with the real verdicts, and every
    // Gamsberg line lands here.
    const [row] = registerRowsToCsv([toRepairChain(apiRow({ leadTimeStatus: "NO_LEAD_TIME" }))])
    const cell = (header: string) => row[REGISTER_CSV_HEADERS.indexOf(header)]
    expect(cell("Lead-time status")).toBe("")
  })

  it("follows the screen: status first, declaration and justification next, reference columns last", () => {
    const at = (header: string) => REGISTER_CSV_HEADERS.indexOf(header)
    expect(at("Repair status")).toBeLessThan(at("Declaration status"))
    expect(at("Declaration status")).toBeLessThan(at("Justification"))
    for (const reference of ["Criticality", "Stock on hand", "Reorder point", "Repair PR", "Repair PO"]) {
      expect(at(reference)).toBeGreaterThan(at("Justification"))
    }
  })

  it("exports who declared and the justification, empty when there is none", () => {
    const cell = (row: (string | number)[], header: string) =>
      row[REGISTER_CSV_HEADERS.indexOf(header)]
    const [declared, bare] = registerRowsToCsv([
      toRepairChain(
        apiRow({
          declarationStatus: "Completed",
          declaredBy: "R. Kruger",
          declaredAt: "2026-09-12T09:30:00Z",
          justification: { status: "RECORDED", entries: [], unjustifiedPurchases: [] },
        }),
      ),
      toRepairChain(apiRow()),
    ])
    expect(cell(declared, "Declared by")).toBe("R. Kruger")
    expect(cell(declared, "Justification")).toBe("Recorded")
    // A dash is screen punctuation; in a spreadsheet it is a value.
    expect(cell(bare, "Declared by")).toBe("")
    expect(cell(bare, "Justification")).toBe("")
  })

  it("flags a partial receipt in place of the old receipt-status column", () => {
    // The only thing the receipt status said that the repair status does not.
    expect(REGISTER_CSV_HEADERS).not.toContain("Receipt status")
    const cell = (row: (string | number)[], header: string) =>
      row[REGISTER_CSV_HEADERS.indexOf(header)]
    const [partial, whole] = registerRowsToCsv([
      toRepairChain(apiRow({ receiptStatus: "Partially Received" })),
      toRepairChain(apiRow({ receiptStatus: "Received" })),
    ])
    expect(cell(partial, "Partially received")).toBe("Yes")
    expect(cell(whole, "Partially received")).toBe("No")
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

describe("isListedInRegister", () => {
  /**
   * The register stopped listing PO-issued lines that are blocked in SAP or
   * already partly back, on 14-Oct-2026. On live data that is 92 lines of
   * 5,155: 89 blocked and 3 partly received.
   */
  const listed = (overrides: Partial<ApiRepairChain> = {}) =>
    isListedInRegister(toRepairChain(apiRow({ repairStatus: "PO Issued", ...overrides })))

  it("lists a PO-issued line with nothing against it", () => {
    expect(listed()).toBe(true)
  })

  it("does not list one blocked in SAP", () => {
    expect(listed({ poBlocked: true })).toBe(false)
  })

  it("does not list one that has already come back in part", () => {
    expect(listed({ receiptStatus: "Partially Received" })).toBe(false)
  })

  it("leaves every other stage alone, flags and all", () => {
    // Scoped to the stage the request named. Two live lines sit here -- one
    // Closed and blocked, one At Vendor and partly received -- and dropping
    // them would be this filter deciding something nobody asked it to.
    const atVendor = apiRow({ repairStatus: "At Vendor", receiptStatus: "Partially Received" })
    const closed = apiRow({ repairStatus: "Closed", poBlocked: true })
    expect(isListedInRegister(toRepairChain(atVendor))).toBe(true)
    expect(isListedInRegister(toRepairChain(closed))).toBe(true)
  })
})

describe("registerDescription", () => {
  const meta = { totalLines: 1181, openLines: 744 } as ApiRegisterMeta

  it("says how many deleted lines were left out, and how many blocked ones kept", () => {
    const text = registerDescription({ ...meta, excludedDeletedLines: 44, blockedLines: 72 }, "2026-09-24")
    expect(text).toContain("44 lines deleted in SAP are excluded")
    expect(text).toContain("72 lines blocked in SAP are included and flagged")
  })

  it("names the lines the register does not list, so the counts can be reconciled", () => {
    // 5,155 in the caption over 5,063 in the table, with nothing to explain
    // the gap, is how a number stops being trusted.
    const text = registerDescription(meta, "2026-09-24", null, 92)
    expect(text).toContain(
      "92 PO-issued lines blocked in SAP or partly received are not listed",
    )
  })

  it("reads as one line, not as '1 lines'", () => {
    expect(registerDescription({ ...meta, blockedLines: 1 }, "2026-09-24", null, 1)).toContain(
      "1 PO-issued line blocked in SAP or partly received is not listed. 1 line blocked in SAP is included and flagged.",
    )
  })

  it("says nothing about exclusions a backend does not report", () => {
    const text = registerDescription(meta, "2026-09-24")
    expect(text).not.toContain("deleted")
    expect(text).not.toContain("blocked")
    expect(text).not.toContain("not listed")
  })

  // The caption used to open "1,181 repair lines from the July extract" in
  // static text, and went on saying it after a CSV full pull had replaced
  // every raw table underneath -- so the one line a reader would use to tell
  // the two sources apart was the one line that could not know.
  it("never names the source, whatever the backend serves", () => {
    const withStamp = registerDescription(meta, "2026-09-24", "2026-10-07T05:01:11Z")
    const without = registerDescription(meta, "2026-09-24")
    for (const text of [withStamp, without]) {
      expect(text).not.toContain("July")
      expect(text).not.toContain("extract")
    }
    expect(withStamp).toContain("1,181 repair lines — 744 still open")
  })

  it("reports how fresh the data is when the backend says", () => {
    const text = registerDescription(meta, "2026-09-24", "2026-10-07T05:01:11Z")
    expect(text).toContain("SAP data loaded")
    expect(text).toContain("2026")
  })

  it("claims no freshness the backend did not give it", () => {
    for (const absent of [undefined, null, ""]) {
      expect(registerDescription(meta, "2026-09-24", absent)).not.toContain("loaded")
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
