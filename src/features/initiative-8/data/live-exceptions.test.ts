import { describe, expect, it } from "vitest"

import {
  EXCEPTION_CSV_HEADERS,
  exceptionPlantOptions,
  exceptionRowsToCsv,
  exceptionTypeOptions,
  filterExceptions,
  toRepairException,
} from "@/features/initiative-8/data/live-exceptions"
import { EXCEPTION_SEVERITY_TONE, exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import type { ApiExceptionItem } from "@/lib/api/i8"

/**
 * The exception-queue adapter.
 *
 * What earns a test here: the second check's extra line (`acquisitionLine`)
 * arriving intact, a type this build has never heard of still rendering, and
 * nothing being invented where the backend sent null.
 */

/** A row shaped exactly as `GET /api/i8/exceptions` sends one. */
function apiRow(overrides: Partial<ApiExceptionItem> = {}): ApiExceptionItem {
  return {
    id: "EX-MISSING_ATTESTATION-4500001052-1310",
    type: "MISSING_ATTESTATION",
    severity: "warning",
    material: {
      materialId: "8000004665",
      materialCode: "8000004665",
      description: "CYLINDER HYDRAULIC PN:3128008216",
    },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    repairLine: { type: "PO", documentNumber: "4500001052", line: "1310" },
    acquisitionLine: null,
    title: "No condition-to-repair attestation",
    detail:
      "No attestation was found for material 8000004665 at plant 1300 within 30 days of 2025-04-07.",
    raisedAt: "2025-04-07",
    isOpenRepair: true,
    preAutomation: false,
    ...overrides,
  }
}

const acquisition = apiRow({
  id: "EX-UNJUSTIFIED_ACQUISITION-4500009999-10",
  type: "UNJUSTIFIED_ACQUISITION",
  severity: "critical",
  plant: { plantId: "1500", name: "Gamsberg" },
  acquisitionLine: { type: "PO", documentNumber: "4500009999", line: "10" },
  title: "New unit bought while a repair was open",
  isOpenRepair: false,
})

describe("toRepairException", () => {
  it("builds the register detail id from the repair line", () => {
    expect(toRepairException(apiRow()).repairId).toBe("4500001052-1310")
  })

  it("builds no link when the repair line has no item number", () => {
    // "4500001052-" would 404 on a line that may well exist.
    const row = apiRow({ repairLine: { type: "PO", documentNumber: "4500001052", line: null } })
    expect(toRepairException(row).repairId).toBeUndefined()
  })

  it("carries the new-purchase line of an unjustified acquisition", () => {
    const item = toRepairException(acquisition)
    expect(item.acquisitionLine).toEqual({ type: "PO", documentNumber: "4500009999", line: "10" })
    // The repair line is still the repair that was open at the time.
    expect(item.repairLine.documentNumber).toBe("4500001052")
  })

  it("has no acquisition line for a missing attestation — null or absent", () => {
    expect(toRepairException(apiRow({ acquisitionLine: null })).acquisitionLine).toBeUndefined()
    // A backend that predates the field does not send it at all.
    const older = apiRow()
    delete older.acquisitionLine
    expect(toRepairException(older).acquisitionLine).toBeUndefined()
  })

  it("keeps a type it has never heard of, and gives it a readable label", () => {
    const item = toRepairException(apiRow({ type: "MISSING_SESSION_ID" }))
    expect(item.type).toBe("MISSING_SESSION_ID")
    expect(exceptionTypeLabel(item.type)).toBe("Missing session id")
  })

  it("reads an unrecognised severity as a warning, never as info", () => {
    const item = toRepairException(apiRow({ severity: "urgent" as ApiExceptionItem["severity"] }))
    expect(item.severity).toBe("warning")
    expect(EXCEPTION_SEVERITY_TONE[item.severity]).toBe("warning")
  })

  it("leaves a missing plant and date unknown rather than guessed", () => {
    const item = toRepairException(apiRow({ plant: null, raisedAt: null }))
    expect(item.plant).toBeUndefined()
    expect(item.raisedAt).toBeUndefined()
  })

  it("formats the raised date for display", () => {
    const raised = toRepairException(apiRow()).raisedAt
    expect(raised).toContain("2025")
    expect(raised).not.toContain("-")
  })
})

describe("the queue's filters", () => {
  const items = [apiRow(), acquisition, apiRow({ id: "x", type: "SOMETHING_NEW", isOpenRepair: false })].map(
    toRepairException,
  )

  it("offers every type the backend counted — known or not — most frequent first", () => {
    const options = exceptionTypeOptions({
      byType: { MISSING_ATTESTATION: 1181, UNJUSTIFIED_ACQUISITION: 12, SOMETHING_NEW: 3 },
    })
    expect(options.map((o) => o.value)).toEqual([
      "MISSING_ATTESTATION",
      "UNJUSTIFIED_ACQUISITION",
      "SOMETHING_NEW",
    ])
    expect(options[1].label).toBe("Unjustified acquisition")
    expect(options[2].label).toBe("Something new")
  })

  it("lists the plants on the rows", () => {
    expect(exceptionPlantOptions(items).map((p) => p.plantId)).toEqual(["1300", "1500"])
  })

  it("filters by type, plant and open repairs", () => {
    const all = { type: "all", plant: "all", openOnly: false }
    expect(filterExceptions(items, all)).toHaveLength(3)
    expect(filterExceptions(items, { ...all, type: "UNJUSTIFIED_ACQUISITION" })).toHaveLength(1)
    expect(filterExceptions(items, { ...all, plant: "1500" }).map((i) => i.type)).toEqual([
      "UNJUSTIFIED_ACQUISITION",
    ])
    expect(filterExceptions(items, { ...all, openOnly: true })).toHaveLength(1)
  })
})

describe("exceptionRowsToCsv", () => {
  it("writes one full-width row per exception handed in", () => {
    const rows = exceptionRowsToCsv([apiRow(), acquisition].map(toRepairException))
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row).toHaveLength(EXCEPTION_CSV_HEADERS.length)
  })

  it("exports both lines of an unjustified acquisition, and the type code", () => {
    const [row] = exceptionRowsToCsv([toRepairException(acquisition)])
    const cell = (header: string) => row[EXCEPTION_CSV_HEADERS.indexOf(header)]
    expect(cell("Type")).toBe("UNJUSTIFIED_ACQUISITION")
    expect(cell("Repair line")).toBe("4500001052/1310")
    expect(cell("Acquisition line")).toBe("4500009999/10")
    expect(cell("Repair still open")).toBe("No")
  })

  it("leaves the acquisition line empty for a missing attestation", () => {
    const [row] = exceptionRowsToCsv([toRepairException(apiRow())])
    expect(row[EXCEPTION_CSV_HEADERS.indexOf("Acquisition line")]).toBe("")
    expect(row[EXCEPTION_CSV_HEADERS.indexOf("Raised before Spares Automation")]).toBe("No")
  })
})
