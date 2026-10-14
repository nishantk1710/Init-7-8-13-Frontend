import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ getExceptions: vi.fn() }))

vi.mock("@/lib/api/i8", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/i8")>()),
  ...api,
}))

import { loadLiveExceptions } from "@/features/initiative-8/data/live-exceptions"

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
    isOpenRepair: false,
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
