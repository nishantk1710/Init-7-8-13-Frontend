import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ getExceptions: vi.fn() }))

vi.mock("@/lib/api/i8", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/i8")>()),
  ...api,
}))

import {
  activeExceptionFilters,
  exceptionsHref,
  fetchAllExceptions,
  loadExceptionsPage,
  loadLiveExceptions,
  parseExceptionParams,
  toExceptionRow,
} from "@/features/initiative-8/data/live-exceptions"
import type { ApiExceptionItem } from "@/lib/api/i8"

/**
 * What this loader must not let through: `UNJUSTIFIED_ACQUISITION`.
 *
 * The check came off the queue on 14-Oct-2026 — FR-5b asks for the reason at
 * the reservation, so it is a control rather than a queue item — and these
 * tests are here because dropping rows without dropping their counts is the
 * failure mode that matters. A band reading "5,973 raised" over a table
 * holding 5,153 is worse than either number alone.
 */

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "EX-MISSING_ATTESTATION-4100067718-10",
    type: "MISSING_ATTESTATION",
    severity: "info",
    material: { materialId: "8000002255", materialCode: "8000002255", description: null },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "4100067718", line: "10" },
    acquisitionLine: null,
    title: "No condition-to-repair attestation",
    detail: "No attestation was found.",
    raisedAt: "2018-09-04",
    preAutomation: false,
    status: "OPEN",
    owner: null,
    stillDetected: true,
    history: [],
    ...overrides,
  }
}

function unjustified(overrides: Record<string, unknown> = {}) {
  return item({
    id: "EX-UNJUSTIFIED_ACQUISITION-4100100001-10",
    type: "UNJUSTIFIED_ACQUISITION",
    severity: "warning",
    acquisitionLine: { type: "PO", documentNumber: "4100100001", line: "10" },
    ...overrides,
  })
}

function page(items: unknown[], meta: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 500,
    referenceDate: "2026-10-14",
    meta: {
      total: items.length,
      actionable: items.length,
      preAutomation: 0,
      byType: { MISSING_ATTESTATION: 1, UNJUSTIFIED_ACQUISITION: 1 },
      bySeverity: { info: 1, warning: 1 },
      linesChecked: 10,
      linesCovered: 2,
      typesRaised: ["MISSING_ATTESTATION", "UNJUSTIFIED_ACQUISITION", "OVERDUE_REPAIR"],
      attestationWindowDays: 30,
      justificationWindowDays: 30,
      acquisitionsChecked: 6837,
      ...meta,
    },
  }
}

beforeEach(() => {
  api.getExceptions.mockReset()
})

describe("loadLiveExceptions", () => {
  it("drops unjustified-acquisition rows and the counts that came with them", async () => {
    api.getExceptions.mockResolvedValue(page([item(), unjustified()]))

    const { rows, summary } = await loadLiveExceptions()

    expect(rows.map((r) => r.type)).toEqual(["MISSING_ATTESTATION"])
    expect(summary.total).toBe(1)
    expect(summary.actionable).toBe(1)
    expect(summary.byType).toEqual({ MISSING_ATTESTATION: 1 })
    expect(summary.bySeverity).toEqual({ info: 1, warning: 0 })
  })

  it("takes the type out of typesRaised, so no filter offers it", async () => {
    // The half that shows on the deployed backend today: it raises none of
    // these and still declares the check, which put the type in the filter
    // dropdown and in "How each check works" with nothing behind it.
    api.getExceptions.mockResolvedValue(
      page([item()], { byType: { MISSING_ATTESTATION: 1 }, bySeverity: { info: 1 } }),
    )

    const { summary } = await loadLiveExceptions()

    expect(summary.typesRaised).toEqual(["MISSING_ATTESTATION", "OVERDUE_REPAIR"])
  })

  it("leaves the justification check's own measurements alone", async () => {
    // The check still runs and the Justifications screen still reports it.
    // Only the queue stops carrying its findings.
    api.getExceptions.mockResolvedValue(page([item(), unjustified()]))

    const { summary } = await loadLiveExceptions()

    expect(summary.acquisitionsChecked).toBe(6837)
    expect(summary.justificationWindowDays).toBe(30)
    expect(summary.linesChecked).toBe(10)
    expect(summary.linesCovered).toBe(2)
  })

  it("subtracts a dropped pre-automation row from preAutomation, not from actionable", async () => {
    api.getExceptions.mockResolvedValue(
      page([item(), unjustified({ preAutomation: true })], {
        actionable: 1,
        preAutomation: 1,
      }),
    )

    const { summary } = await loadLiveExceptions()

    expect(summary.total).toBe(1)
    expect(summary.preAutomation).toBe(0)
    expect(summary.actionable).toBe(1)
  })

  it("does not raise the partial-queue banner over rows it dropped itself", async () => {
    // `truncated` asks whether the fetch stopped short of the backend's total.
    // The dropped rows arrived; they are simply not shown.
    api.getExceptions.mockResolvedValue(page([item(), unjustified()]))

    expect((await loadLiveExceptions()).truncated).toBe(false)
  })
})

/**
 * The Exceptions screen pages on the server. What these pin: the screen opens
 * on Open and its URL says so only when it is not; the queue's own two
 * parameters go on every request; and the dropdowns are not built from one
 * page.
 */

describe("parseExceptionParams", () => {
  it("opens on Open, with nothing else narrowing it", () => {
    expect(parseExceptionParams({})).toEqual({
      filters: {
        q: undefined,
        type: undefined,
        plant: undefined,
        status: "OPEN",
        repair: undefined,
      },
      page: 1,
      id: undefined,
    })
  })

  it("ignores the old ?open=1 filter: every repair line it names is open in SAP", () => {
    expect(parseExceptionParams({ open: "1" }).filters).not.toHaveProperty("open")
  })

  it("reads every filter, the page and the linked item", () => {
    expect(
      parseExceptionParams({
        q: " pump ",
        type: "OVERDUE_REPAIR",
        plant: "1500",
        status: "closed",
        repair: "4500000677-20",
        page: "3",
        id: "EX-1",
      }),
    ).toEqual({
      filters: {
        q: "pump",
        type: "OVERDUE_REPAIR",
        plant: "1500",
        status: "CLOSED",
        repair: "4500000677-20",
      },
      page: 3,
      id: "EX-1",
    })
  })

  it("reads status=all as every status", () => {
    expect(parseExceptionParams({ status: "all" }).filters.status).toBeUndefined()
  })

  it("reads a retired status in an old link as the one it became", () => {
    expect(parseExceptionParams({ status: "in_progress" }).filters.status).toBe("OPEN")
    expect(parseExceptionParams({ status: "RESOLVED" }).filters.status).toBe("CLOSED")
  })

  it("treats a repeated or malformed value as absent", () => {
    expect(parseExceptionParams({ plant: ["1300", "1500"], page: "0", id: ["a", "b"] })).toMatchObject({
      filters: { plant: undefined },
      page: 1,
      id: undefined,
    })
  })
})

describe("toExceptionRow: two statuses since 21-Oct-2026", () => {
  const event = (status: string) => ({
    id: "EXE-1",
    kind: "STATUS" as const,
    status,
    actor: "priya",
    text: "",
    at: "2026-10-20T10:00:00",
  })

  it("reads a backend older than the change in the two statuses", () => {
    const inProgress = toExceptionRow(
      item({ status: "IN_PROGRESS", history: [event("IN_PROGRESS")] }) as ApiExceptionItem,
    )
    const resolved = toExceptionRow(
      item({ status: "RESOLVED", history: [event("RESOLVED")] }) as ApiExceptionItem,
    )

    expect(inProgress.status).toBe("OPEN")
    expect(inProgress.history[0].status).toBe("OPEN")
    expect(resolved.status).toBe("CLOSED")
    expect(resolved.history[0].status).toBe("CLOSED")
  })

  it("passes the current two through", () => {
    expect(toExceptionRow(item({ status: "CLOSED" }) as ApiExceptionItem).status).toBe("CLOSED")
    expect(toExceptionRow(item() as ApiExceptionItem).status).toBe("OPEN")
  })
})

describe("exceptionsHref", () => {
  it("is the bare path for the screen as it opens", () => {
    expect(exceptionsHref({ status: "OPEN" })).toBe("/repairable-spares/exceptions")
  })

  it("keeps the filters, says status=all for every status, and drops page 1", () => {
    expect(
      exceptionsHref({ q: "pump seal", status: undefined, repair: "4500000677-20" }, 2),
    ).toBe("/repairable-spares/exceptions?q=pump+seal&status=all&repair=4500000677-20&page=2")
    expect(exceptionsHref({ type: "OVERDUE_REPAIR", status: "CLOSED" }, 1)).toBe(
      "/repairable-spares/exceptions?type=OVERDUE_REPAIR&status=CLOSED",
    )
  })

  it("reads back as the same filters", () => {
    const filters = {
      q: "pump",
      type: "OVERDUE_REPAIR",
      plant: "1300",
      status: undefined,
      repair: "4500000677-20",
    }
    const raw = Object.fromEntries(new URL(exceptionsHref(filters, 4), "http://x").searchParams)

    expect(parseExceptionParams(raw)).toEqual({ filters, page: 4, id: undefined })
  })
})

describe("activeExceptionFilters", () => {
  it("does not count the status the screen opens on", () => {
    expect(activeExceptionFilters({ status: "OPEN" })).toBe(0)
    expect(activeExceptionFilters({ status: undefined })).toBe(1)
    expect(activeExceptionFilters({ status: "OPEN", repair: "4500000677-20", q: "pump" })).toBe(2)
  })
})

describe("loadExceptionsPage", () => {
  it("asks for one page, with the queue's own two parameters always on", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([item()]))

    await loadExceptionsPage({ status: "OPEN", plant: "1300", q: "pump" }, 3, {
      pageSize: 25,
      fetchPage,
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({
      q: "pump",
      plant: "1300",
      status: "OPEN",
      actionableOnly: true,
      excludeType: "UNJUSTIFIED_ACQUISITION",
      page: 3,
      pageSize: 25,
    })
  })

  it("counts every match, not the page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ ...page([item()]), total: 240 })

    expect((await loadExceptionsPage({}, 1, { fetchPage })).total).toBe(240)
  })

  it("takes the dropdowns from the server, adding the checks that run", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      ...page([item()]),
      facets: {
        plants: [
          { plantId: "1300", name: "Black Mountain Mining" },
          { plantId: "1500", name: "Gamsberg" },
        ],
        types: ["MISSING_ATTESTATION"],
      },
    })

    const { facets } = await loadExceptionsPage({ plant: "1300" }, 1, { fetchPage })

    // Choosing 1300 must not take 1500 out of the list.
    expect(facets.plants.map((p) => p.plantId)).toEqual(["1300", "1500"])
    // OVERDUE_REPAIR runs and found nothing on this page: still a choice. The
    // dropped type is not, though the backend declares it.
    expect(facets.types).toEqual(["MISSING_ATTESTATION", "OVERDUE_REPAIR"])
  })

  it("falls back to the page's rows when the backend sends no facets", async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      page([item({ id: "EX-2", plant: { plantId: "1500", name: "Gamsberg" } }), item()]),
    )

    const { facets } = await loadExceptionsPage({}, 1, { fetchPage })

    expect(facets.plants).toEqual([
      { plantId: "1300", name: "Black Mountain Mining" },
      { plantId: "1500", name: "Gamsberg" },
    ])
  })

  it("keeps a dropped type off the screen even from a backend that ignores excludeType", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([item(), unjustified()]))

    const { rows, summary } = await loadExceptionsPage({}, 1, { fetchPage })

    expect(rows.map((r) => r.type)).toEqual(["MISSING_ATTESTATION"])
    expect(summary.typesRaised).toEqual(["MISSING_ATTESTATION", "OVERDUE_REPAIR"])
    expect(summary.byType).toEqual({ MISSING_ATTESTATION: 1 })
  })
})

describe("fetchAllExceptions", () => {
  const batch = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => item({ id: `EX-${start + i}` }))

  it("pages until the count is reached, with the screen's filters", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ ...page(batch(0, 500)), total: 700 })
      .mockResolvedValueOnce({ ...page(batch(500, 200)), total: 700 })

    const rows = await fetchAllExceptions({ status: undefined, type: "OVERDUE_REPAIR" }, fetchPage)

    expect(rows).toHaveLength(700)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "OVERDUE_REPAIR",
        excludeType: "UNJUSTIFIED_ACQUISITION",
        page: 2,
        pageSize: 500,
      }),
    )
  })

  it("drops the repeat an item raised mid-export causes", async () => {
    // One new item arrived between the requests, so the second page starts
    // with the last item of the first.
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ ...page(batch(0, 500)), total: 701 })
      .mockResolvedValueOnce({ ...page(batch(499, 202)), total: 701 })

    const rows = await fetchAllExceptions({}, fetchPage)

    expect(rows).toHaveLength(701)
    expect(new Set(rows.map((r) => r.id)).size).toBe(701)
  })

  it("stops on a short page even if the count says more", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ ...page(batch(0, 3)), total: 9000 })

    expect(await fetchAllExceptions({}, fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
