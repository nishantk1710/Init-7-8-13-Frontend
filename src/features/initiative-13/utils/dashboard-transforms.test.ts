import { describe, expect, it } from "vitest"

import type { ActExceptionDetail, PlanVsIssuedRow, WatchMetric } from "@/lib/api/i13"
import {
  buildLastRefreshedAt,
  countByField,
  filterNonMovers,
  justificationRowsToCsv,
  nonMoverRowsToCsv,
  planVsIssuedRowsToCsv,
} from "./dashboard-transforms"
import { selectConfirmedExceptions } from "@/lib/api/i13"

function watchRow(overrides: Partial<WatchMetric>): WatchMetric {
  return {
    material: "MAT-1",
    plant: "1300",
    materialScope: "OAR",
    stockOnHand: 10,
    openPoQuantity: 0,
    averageMonthlyConsumption: 0,
    monthsOfCover: null,
    projectedMonthsOfCover: null,
    monthsOfCoverReason: null,
    lastMovementDate: null,
    daysSinceLastMovement: null,
    lastIssueDate: null,
    daysSinceLastIssue: null,
    consumptionCount12m: 0,
    consumedQty12m: 0,
    inventoryTurns: null,
    inventoryTurnsReason: null,
    agingBand: "FAST",
    grNotIssuedFlag: false,
    grNotIssuedDaysSinceGr: null,
    grNotIssuedRelevantGrDate: null,
    grNotIssuedThresholdDays: 30,
    grNotIssuedReceivedQuantity: 0,
    grNotIssuedIssuedQuantity: 0,
    grNotIssuedOutstandingQuantity: 0,
    acquiredVsPlanStatus: "NO_PLAN",
    plannedQuantity: null,
    receivedQuantity: 0,
    issuedQuantity: 0,
    acquiredVsPlanVarianceQuantity: null,
    acquiredVsPlanVariancePercentage: null,
    calculatedAt: null,
    ...overrides,
  }
}

describe("countByField", () => {
  it("groups rows by the given key, never inventing a bucket with no rows", () => {
    const rows = [watchRow({ agingBand: "FAST" }), watchRow({ agingBand: "FAST" }), watchRow({ agingBand: "SLOW" })]
    expect(countByField(rows, (r) => r.agingBand)).toEqual([
      { bucket: "FAST", count: 2 },
      { bucket: "SLOW", count: 1 },
    ])
  })

  it("returns an empty array for an empty input, not a zero-filled distribution", () => {
    expect(countByField<WatchMetric>([], (r) => r.agingBand)).toEqual([])
  })
})

describe("filterNonMovers", () => {
  it("keeps only backend-classified NON_MOVING rows", () => {
    const rows = [watchRow({ material: "A", agingBand: "FAST" }), watchRow({ material: "B", agingBand: "NON_MOVING" })]
    expect(filterNonMovers(rows).map((r) => r.material)).toEqual(["B"])
  })
})

describe("buildLastRefreshedAt", () => {
  it("picks the most recent calculatedAt", () => {
    const rows = [{ calculatedAt: "2026-09-01T00:00:00Z" }, { calculatedAt: "2026-09-15T00:00:00Z" }]
    expect(buildLastRefreshedAt(rows)).toBe("2026-09-15T00:00:00Z")
  })

  it("is null when no row carries a timestamp, never a fabricated 'now'", () => {
    expect(buildLastRefreshedAt([{ calculatedAt: null }])).toBeNull()
    expect(buildLastRefreshedAt([])).toBeNull()
  })
})

describe("nonMoverRowsToCsv", () => {
  it("exports exactly the rows it was given (the caller's already-filtered set), with no critical-impact column", () => {
    const csv = nonMoverRowsToCsv([watchRow({ material: "A" }), watchRow({ material: "B" })])
    expect(csv).toHaveLength(2)
    expect(csv[0][0]).toBe("A")
    expect(csv[0]).toHaveLength(6)
  })
})

describe("selectConfirmedExceptions (justification log)", () => {
  function detail(overrides: Partial<ActExceptionDetail>): ActExceptionDetail {
    return {
      exceptionId: "EXC-1",
      exceptionType: "PLAN_BREACH",
      status: "CONFIRMED",
      material: "MAT-1",
      plant: "1300",
      reservationNumber: null,
      reservationItem: null,
      sessionId: null,
      ledgerEntryId: null,
      ownerRequesterId: "U1",
      detectedAt: "2026-09-01T00:00:00Z",
      requesterDueAt: null,
      escalatedAt: null,
      resolvedAt: null,
      currentAssigneeType: null,
      currentAssigneeId: null,
      routingStatus: null,
      reason: "plan breach",
      evidence: {},
      createdAt: null,
      updatedAt: null,
      crossPlantStock: [],
      confirmation: null,
      ...overrides,
    }
  }

  it("keeps only exceptions with a non-null confirmation", () => {
    const withConfirmation = detail({
      exceptionId: "EXC-1",
      confirmation: {
        exceptionId: "EXC-1",
        reasonCategory: "PLANNED_MAINTENANCE",
        freeText: "Scheduled shutdown consumption.",
        actorId: "U1",
        submittedAt: "2026-09-02T00:00:00Z",
      },
    })
    const withoutConfirmation = detail({ exceptionId: "EXC-2", confirmation: null })

    const result = selectConfirmedExceptions([withConfirmation, withoutConfirmation])

    expect(result).toHaveLength(1)
    expect(result[0].exceptionId).toBe("EXC-1")
    expect(result[0].reasonCategory).toBe("PLANNED_MAINTENANCE")
  })

  it("is an empty, non-fabricated array when nothing has been confirmed", () => {
    expect(selectConfirmedExceptions([detail({ confirmation: null })])).toEqual([])
  })
})

describe("justificationRowsToCsv", () => {
  it("flattens each entry to one row, columns in a stable order", () => {
    const rows = justificationRowsToCsv([
      {
        exceptionId: "EXC-1",
        exceptionType: "PLAN_BREACH",
        material: "MAT-1",
        plant: "1300",
        ownerRequesterId: "U1",
        reasonCategory: "PLANNED_MAINTENANCE",
        freeText: "Scheduled shutdown consumption.",
        actorId: "U1",
        submittedAt: "2026-09-02T00:00:00Z",
      },
    ])
    expect(rows).toEqual([
      ["EXC-1", "PLAN_BREACH", "MAT-1", "1300", "U1", "PLANNED_MAINTENANCE", "Scheduled shutdown consumption.", "U1", "2026-09-02T00:00:00Z"],
    ])
  })
})

function planRow(overrides: Partial<PlanVsIssuedRow>): PlanVsIssuedRow {
  return {
    rowId: "RES-1-1",
    source: "SAP",
    material: "MAT-1",
    materialDescription: null,
    plant: "1300",
    reservations: ["2022510/1"],
    sessionId: null,
    planId: null,
    plannedQuantity: "15.000",
    issuedQuantity: "15.000",
    status: "ON_PLAN",
    varianceQuantity: "0",
    variancePercentage: 0,
    dueDate: "2026-06-04",
    windowStart: null,
    overdue: false,
    ...overrides,
  }
}

describe("planVsIssuedRowsToCsv", () => {
  it("exports both sources the same way, with the overdue marker", () => {
    const rows = [
      planRow({}),
      planRow({
        rowId: "PLAN-P1", source: "ASSISTANT", reservations: [], sessionId: "SABC", planId: "P1",
        plannedQuantity: "5.000", issuedQuantity: "0", status: "BELOW_PLAN",
        varianceQuantity: "-5.000", variancePercentage: -100, dueDate: "2026-10-23", overdue: true,
      }),
      planRow({
        rowId: "PLAN-P2", source: "ASSISTANT", reservations: [], sessionId: "SDEF", planId: "P2",
        plannedQuantity: "2.000", issuedQuantity: "0", status: "NO_RESERVATION",
        varianceQuantity: null, variancePercentage: null, dueDate: "2026-12-01",
      }),
    ]
    expect(planVsIssuedRowsToCsv(rows)).toEqual([
      ["Direct from SAP", "MAT-1", "1300", "2022510/1", "15.000", "15.000", "On plan", "2026-06-04", "No"],
      ["Via assistant", "MAT-1", "1300", "", "5.000", "0", "Below plan", "2026-10-23", "Yes"],
      ["Via assistant", "MAT-1", "1300", "", "2.000", "0", "Awaiting reservation", "2026-12-01", "No"],
    ])
  })
})
