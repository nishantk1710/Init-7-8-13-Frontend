import { describe, expect, it, vi } from "vitest"

import {
  activeRegisterFilters,
  buildRegisterOptions,
  fetchAllRegisterLines,
  loadRegisterPage,
  parseRegisterParams,
  registerDescription,
  registerHref,
  registerViewChoices,
  ruleIsOn,
  toRegisterLine,
  toRepairChain,
} from "@/features/initiative-8/data/live-register"
import {
  REGISTER_CSV_HEADERS,
  registerRowsToCsv,
} from "@/features/initiative-8/utils/register-view"
import {
  NO_CRITICALITY,
  isOpenRepair,
  isPrOnly,
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
    overdueStatus: "OVERDUE",
    leadTimeStatus: "BEYOND_LEAD_TIME",
    declarationStatus: "Required",
    daysOpen: 526,
    agingBucket: "60+",
    leadTimeDays: 31,
    daysElapsed: 526,
    daysOverLeadTime: 495,
    daysInCurrentStage: 526,
    daysRemainingInRepair: -500,
    raisedAt: "2025-04-07",
    poIssuedAt: "2025-04-07",
    sentToVendorAt: null,
    expectedReturn: "2025-05-07",
    orderedQty: "1.000",
    unit: "EA",
    repairCost: "8914.34",
    newUnitLeadTimeDays: 31,
    itemCategory: "3",
    docType: "ZREP",
    corroboratedByDocType: true,
    hasPoHeader: true,
    scheduleLines: 1,
    criticality: null,
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
    // Since 27-Oct-2026 the fallback is what the row's documents prove: this
    // line has a PO, so it is at least "PO Issued" -- not "PR Raised".
    const chain = toRepairChain(
      apiRow({ repairStatus: "In Transit Return" } as Partial<ApiRepairChain>),
    )
    expect(chain.repairStatus).toBe("PO Issued")
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
    expect(isRepairOverdue(toRepairChain(apiRow({ overdueStatus: "ON_TIME" })))).toBe(false)
  })

  it("reads every live line as open -- the register serves no other kind", () => {
    // Since 19-Oct-2026 a line SAP has marked "Delivery completed", deleted or
    // blocked is not served at all, so nothing here can read as back.
    for (const overdueStatus of ["OVERDUE", "ON_TIME", "NO_DUE_DATE"] as const) {
      expect(isOpenRepair(toRepairChain(apiRow({ overdueStatus })))).toBe(true)
    }
  })

  it("carries no receipt fields -- goods receipts are not read", () => {
    const chain = toRepairChain(apiRow())
    expect(chain).not.toHaveProperty("receiptStatus")
    expect(chain).not.toHaveProperty("poBlocked")
    expect(chain).not.toHaveProperty("daysAtVendor")
    expect(chain.receivedAt).toBeUndefined()
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
      apiRow({ repairStatus: "Teleported" } as Partial<ApiRepairChain>),
    )
    expect(chain.repairStatus).toBe("PO Issued")
    // With no PO behind it the same unknown status reads as only requested.
    expect(
      toRepairChain(
        apiRow({ repairStatus: "Teleported", repairPo: null } as Partial<ApiRepairChain>),
      ).repairStatus,
    ).toBe("PR Raised")
  })

  it("shows the material number when no description exists anywhere", () => {
    // Around a tenth of the series has a material-master row; some rows have no
    // description from any source. An empty cell would look like a bug.
    const chain = toRepairChain(
      apiRow({ material: { materialId: "8000000007", materialCode: "8000000007", description: null } }),
    )
    expect(chain.material.description).toBe("8000000007")
  })

  it("produces rows with every field the register table filters on", () => {
    const chain = toRepairChain(apiRow())
    for (const key of ["id", "material", "plant", "repairStatus", "declarationStatus", "agingBucket"]) {
      expect(chain).toHaveProperty(key)
    }
  })
})

describe("criticality", () => {
  it("carries a criticality rating through", () => {
    expect(toRepairChain(apiRow({ criticality: "CRITICAL" })).criticality).toBe("CRITICAL")
  })

  it("keeps an unrated line unrated — never NORMAL", () => {
    // ZMM065 rates well under half the universe. Defaulting the rest to NORMAL
    // would quietly downgrade parts nobody has assessed.
    expect(toRepairChain(apiRow({ criticality: null })).criticality).toBeUndefined()
    expect(toRepairChain(apiRow({ criticality: undefined })).criticality).toBeUndefined()
  })
})

describe("buildRegisterOptions", () => {
  const chains = [
    toRepairChain(apiRow({ id: "a", repairStatus: "At Vendor", criticality: "NORMAL" })),
    toRepairChain(apiRow({ id: "b", repairStatus: "PO Issued", criticality: "CRITICAL" })),
    toRepairChain(apiRow({ id: "c", repairStatus: "At Vendor" })),
    toRepairChain(apiRow({ id: "d", repairStatus: "PO Issued", vendor: null, vendorName: null })),
  ]

  it("offers only the repair statuses the data actually has, in lifecycle order", () => {
    // Two occur live -- every line is open in SAP -- not the five the type
    // allows. A status no row has is a filter that can only ever return nothing.
    expect(buildRegisterOptions(chains).repairStatusOptions).toEqual(["PO Issued", "At Vendor"])
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
 * as the filters it was written from, the listing's own parameter goes on
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
    meta: {
      totalLines: 104,
      openLines: 104,
      excludedDeliveryCompletedLines: 4965,
    } as ApiRegisterMeta,
    ...extra,
  }
}

describe("loadRegisterPage", () => {
  const fetchSnapshot = vi.fn().mockResolvedValue({
    rules: { agingBands: "0-15,16-30" },
    sourceLoadedAt: "2026-10-18T03:40:00Z",
  })

  it("asks for one page, with the listing's own parameter always on", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage([apiRow()]))

    await loadRegisterPage({ plant: "1300", q: "pump", exceptions: true }, 3, {
      pageSize: 25,
      fetchPage,
      fetchSnapshot,
    })

    // No excludeHeld since 19-Oct-2026: every line the backend serves is open
    // in SAP, so there is nothing to hold back from the listing. No
    // excludeExceptionType since 27-Oct-2026: the Exceptions column carries
    // "bought new while a repair was open" again, as the queue does.
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({
      q: "pump",
      plant: "1300",
      withExceptions: true,
      page: 3,
      pageSize: 25,
    })
  })

  it("counts every match, and keeps the register's counts for the caption", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage([apiRow()], { total: 40 }))

    const page = await loadRegisterPage({}, 1, { fetchPage, fetchSnapshot })

    expect(page.total).toBe(40)
    expect(page.meta.openLines).toBe(104)
    expect(page.meta.excludedDeliveryCompletedLines).toBe(4965)
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
          repairStatuses: ["At Vendor", "PO Issued"],
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
    expect(facets.repairStatuses).toEqual(["PO Issued", "At Vendor"])
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
      expect.objectContaining({ vendor: "none", page: 2, pageSize: 500 }),
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

  it("carries the overdue status and the lead-time verdict", () => {
    const [row] = registerRowsToCsv([toRepairChain(apiRow())])
    const cell = (header: string) => row[REGISTER_CSV_HEADERS.indexOf(header)]
    expect(cell("Overdue status")).toBe("Overdue")
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

  it("exports no turnaround, partial-receipt or blocked column", () => {
    // Every line is open in SAP and goods receipts are not read (19-Oct-2026),
    // so each would be the same value on every row.
    for (const gone of ["Turnaround (days)", "Partially received", "Blocked in SAP", "Receipt status"]) {
      expect(REGISTER_CSV_HEADERS).not.toContain(gone)
    }
  })
})

describe("overdueStatusOf and isOpenRepair", () => {
  it("uses the backend's overdue status when it sent one", () => {
    expect(overdueStatusOf(toRepairChain(apiRow({ overdueStatus: "NO_DUE_DATE" })))).toBe(
      "NO_DUE_DATE",
    )
  })

  it("reads a closed repair as back, not open", () => {
    const closed = { ...toRepairChain(apiRow()), overdueStatus: "RECEIVED" as const }
    expect(isOpenRepair(closed)).toBe(false)
    expect(isOpenRepair(toRepairChain(apiRow()))).toBe(true)
  })
})

describe("registerDescription", () => {
  const meta = { totalLines: 104, openLines: 104 } as ApiRegisterMeta

  it("leads with the open lines, which is every line it lists", () => {
    expect(registerDescription(meta, "2026-10-15")).toContain(
      "104 open repair lines, as at 2026-10-15.",
    )
  })

  it("says what SAP closed, blocked or deleted, so the total can be reconciled", () => {
    const text = registerDescription(
      {
        ...meta,
        excludedDeliveryCompletedLines: 4965,
        excludedBlockedLines: 68,
        excludedDeletedLines: 44,
      },
      "2026-10-15",
    )
    expect(text).toContain("Not shown: 4,965 delivery completed, 68 blocked and 44 deleted in SAP.")
  })

  it("names only the exclusions that occurred", () => {
    const text = registerDescription({ ...meta, excludedDeliveryCompletedLines: 7 }, "2026-10-15")
    expect(text).toContain("Not shown: 7 delivery completed in SAP.")
    expect(text).not.toContain("blocked")
    expect(text).not.toContain("deleted")
  })

  it("names the requests for quotation apart from what SAP closed", () => {
    const text = registerDescription(
      {
        ...meta,
        excludedDeliveryCompletedLines: 4982,
        excludedBlockedLines: 68,
        excludedDeletedLines: 549,
        excludedRfqLines: 1,
      },
      "2026-10-21",
    )
    expect(text).toContain(
      "Not shown: 4,982 delivery completed, 68 blocked and 549 deleted in SAP, " +
        "and 1 on a request for quotation.",
    )
  })

  it("names requests for quotation on their own when nothing else is left out", () => {
    expect(registerDescription({ ...meta, excludedRfqLines: 2 }, "2026-10-21")).toContain(
      "Not shown: 2 on requests for quotation.",
    )
  })

  it("says nothing about exclusions a backend does not report", () => {
    const text = registerDescription(meta, "2026-10-15")
    expect(text).not.toContain("Not shown")
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
    expect(withStamp).toContain("104 open repair lines")
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

describe("repair PRs with no PO yet (27-Oct-2026)", () => {
  /** A PR-only row as section 2.1 of the phase-1 design has the backend send it. */
  function prRow(overrides: Partial<ApiRepairChain> = {}): ApiRepairChain {
    return apiRow({
      id: "PR-2000029113-10",
      lineKind: "PR",
      repairPr: { type: "PR", documentNumber: "2000029113", line: "10" },
      repairPo: null,
      vendor: null,
      vendorName: null,
      repairStatus: "PR Raised",
      overdueStatus: "NOT_ORDERED",
      leadTimeStatus: "NO_LEAD_TIME",
      daysOpen: 12,
      daysElapsed: 12,
      daysInCurrentStage: 12,
      agingBucket: "0-15",
      daysRemainingInRepair: null,
      daysOverLeadTime: null,
      raisedAt: "2026-05-28",
      poIssuedAt: null,
      expectedReturn: null,
      requester: "10305",
      requesterName: "Engineering",
      ...overrides,
    })
  }

  it("reads a PR row as one, with no PO, vendor or due date invented", () => {
    const chain = toRepairChain(prRow())
    expect(chain.lineKind).toBe("PR")
    expect(chain.id).toBe("PR-2000029113-10")
    expect(chain.repairPR).toEqual({ type: "PR", documentNumber: "2000029113", line: "10" })
    expect(chain.repairPO).toBeUndefined()
    expect(chain.vendor).toBeUndefined()
    expect(chain.expectedReturn).toBeUndefined()
    expect(chain.repairStatus).toBe("PR Raised")
    expect(chain.daysOpen).toBe(12)
    expect(isPrOnly(chain)).toBe(true)
  })

  it("carries NOT_ORDERED through, and never reads it as late", () => {
    const chain = toRepairChain(prRow())
    expect(chain.overdueStatus).toBe("NOT_ORDERED")
    expect(overdueStatusOf(chain)).toBe("NOT_ORDERED")
    expect(isRepairOverdue(chain)).toBe(false)
    expect(isOpenRepair(chain)).toBe(true)
  })

  it("carries the department name when the backend knows it, and only then", () => {
    expect(toRepairChain(prRow()).requesterName).toBe("Engineering")
    const unnamed = toRepairChain(prRow({ requesterName: null }))
    expect(unnamed.requester).toBe("10305")
    expect(unnamed.requesterName).toBeUndefined()
  })

  it("reads a row from an older backend, which sends no lineKind, as a PO line", () => {
    const old = apiRow()
    delete old.lineKind
    delete old.requesterName
    const chain = toRepairChain(old)
    expect(chain.lineKind).toBe("PO")
    expect(chain.requesterName).toBeUndefined()
    expect(isPrOnly(chain)).toBe(false)
  })

  it("reads a row with no PO as a PR row even when lineKind is missing", () => {
    // Fail closed: nothing PO-only may be offered on a row with no PO.
    const chain = toRepairChain(prRow({ lineKind: undefined }))
    expect(chain.lineKind).toBe("PR")
    expect(isPrOnly(chain)).toBe(true)
  })

  it("believes the backend's PO marking", () => {
    expect(toRepairChain(apiRow({ lineKind: "PO" })).lineKind).toBe("PO")
  })

  it("exports a PR row as No PO yet, not as an unknown vendor or a missing date", () => {
    const [pr, po] = registerRowsToCsv([toRepairChain(prRow()), toRepairChain(apiRow())])
    const cell = (row: (string | number)[], header: string) => row[REGISTER_CSV_HEADERS.indexOf(header)]

    expect(pr).toHaveLength(REGISTER_CSV_HEADERS.length)
    expect(cell(pr, "Line")).toBe("PR-2000029113-10")
    expect(cell(pr, "Vendor")).toBe("No PO yet")
    expect(cell(pr, "Repair status")).toBe("Repair requested")
    expect(cell(pr, "Overdue status")).toBe("No PO yet")
    expect(cell(pr, "Expected return")).toBe("")
    expect(cell(pr, "Repair PR")).toBe("2000029113/10")
    expect(cell(pr, "Repair PO")).toBe("")
    expect(cell(pr, "Raised")).toBe("28 May 2026")

    // A PO line reads exactly as it did.
    expect(cell(po, "Vendor")).toBe("0001000123")
    expect(cell(po, "Repair status")).toBe("PO Issued")
    expect(cell(po, "Overdue status")).toBe("Overdue")
  })

  it("exports a row with no PO as a PR row even from an older backend", () => {
    const [row] = registerRowsToCsv([toRepairChain(prRow({ lineKind: undefined, overdueStatus: "NO_DUE_DATE" }))])
    expect(row[REGISTER_CSV_HEADERS.indexOf("Vendor")]).toBe("No PO yet")
    expect(row[REGISTER_CSV_HEADERS.indexOf("Overdue status")]).toBe("No PO yet")
  })
})

describe("registerViewChoices", () => {
  const counts = { all: 120, overdue: 40, undeclared: 104, atVendor: 3, withExceptions: 90 }

  it("leaves out the No PO yet pill when an older backend sends no count for it", () => {
    expect(registerViewChoices(counts).map((c) => c.value)).toEqual([
      "",
      "overdue",
      "undeclared",
      "atVendor",
      "withExceptions",
    ])
  })

  it("offers it, with its count, when the backend sends one", () => {
    const choices = registerViewChoices({ ...counts, notOrdered: 16 })
    expect(choices.at(-1)).toEqual({ value: "notOrdered", label: "No PO yet", count: 16 })
    expect(choices[0]).toEqual({ value: "", label: "All", count: 120 })
  })

  describe("on the register screen", () => {
    const values = (choices: { value: string }[]) => choices.map((c) => c.value)

    it("hides the No PO yet pill while the backend's switch is off and it counts 0", () => {
      // The switch-off backend sends notOrdered: 0 on every page; a pill that
      // can only find nothing is noise.
      const choices = registerViewChoices({ ...counts, notOrdered: 0 }, { repairRequestsEnabled: false })
      expect(values(choices)).not.toContain("notOrdered")
      expect(values(choices)).toHaveLength(5)
    })

    it("shows it while the switch is on, even at 0 under a filter", () => {
      const choices = registerViewChoices({ ...counts, notOrdered: 0 }, { repairRequestsEnabled: true })
      expect(choices.at(-1)).toEqual({ value: "notOrdered", label: "No PO yet", count: 0 })
    })

    it("shows it when it counts rows, even if the switch could not be read", () => {
      const choices = registerViewChoices({ ...counts, notOrdered: 4 }, { repairRequestsEnabled: false })
      expect(values(choices)).toContain("notOrdered")
    })

    it("keeps it while it is the selected view, so the selection does not vanish", () => {
      const choices = registerViewChoices(
        { ...counts, notOrdered: 0 },
        { repairRequestsEnabled: false, selected: "notOrdered" },
      )
      expect(values(choices)).toContain("notOrdered")
    })

    it("still leaves it out when an older backend sends no count", () => {
      const choices = registerViewChoices(counts, { repairRequestsEnabled: true, selected: "notOrdered" })
      expect(values(choices)).not.toContain("notOrdered")
    })
  })
})

describe("ruleIsOn", () => {
  it("reads every way the backend can say true", () => {
    for (const value of [true, 1, "true", "True", "1"]) expect(ruleIsOn(value)).toBe(true)
  })

  it("reads absent, false and zero as off", () => {
    for (const value of [undefined, null, false, 0, "false", "False", "0", ""]) {
      expect(ruleIsOn(value)).toBe(false)
    }
  })

  it("is read by the register page from the snapshot, and off when that fails", async () => {
    const fetchPage = vi.fn().mockResolvedValue(registerPage([apiRow()]))
    const on = await loadRegisterPage({}, 1, {
      fetchPage,
      fetchSnapshot: vi.fn().mockResolvedValue({ rules: { repairRequestsEnabled: 1 } }),
    })
    expect(on.repairRequestsEnabled).toBe(true)

    const older = await loadRegisterPage({}, 1, {
      fetchPage,
      fetchSnapshot: vi.fn().mockResolvedValue({ rules: { agingBands: "0-15" } }),
    })
    expect(older.repairRequestsEnabled).toBe(false)

    const failed = await loadRegisterPage({}, 1, {
      fetchPage,
      fetchSnapshot: vi.fn().mockRejectedValue(new Error("down")),
    })
    expect(failed.repairRequestsEnabled).toBe(false)
  })
})
