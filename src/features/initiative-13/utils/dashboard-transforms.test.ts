import { describe, expect, it } from "vitest"

import type { ActExceptionDetail, ReclassificationCandidate, WatchMetric } from "@/lib/api/i13"
import {
  attachCriticalImpactIndicator,
  buildLastRefreshedAt,
  countByField,
  filterNonMovers,
  justificationRowsToCsv,
  matchesCriticalFilter,
  nonMoverRowsToCsv,
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

function candidate(overrides: Partial<ReclassificationCandidate>): ReclassificationCandidate {
  return {
    material: "MAT-1",
    plant: "1300",
    consumptionCount12m: 0,
    consumedMoreThanThreshold: false,
    criticalImpactIndicator: null,
    hodJustifiedRequestIndicator: null,
    dataAvailable: false,
    candidateFlag: false,
    candidateReasons: [],
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

describe("attachCriticalImpactIndicator", () => {
  it("joins on material+plant and passes the backend boolean through unchanged", () => {
    const rows = [watchRow({ material: "A", plant: "1300" })]
    const candidates = [candidate({ material: "A", plant: "1300", criticalImpactIndicator: true })]
    expect(attachCriticalImpactIndicator(rows, candidates)[0].criticalImpactIndicator).toBe(true)
  })

  it("is null (unknown), never false, when no candidate matches the key", () => {
    const rows = [watchRow({ material: "A", plant: "1300" })]
    expect(attachCriticalImpactIndicator(rows, [])[0].criticalImpactIndicator).toBeNull()
  })

  it("does not cross-match a different plant for the same material", () => {
    const rows = [watchRow({ material: "A", plant: "1300" })]
    const candidates = [candidate({ material: "A", plant: "1500", criticalImpactIndicator: true })]
    expect(attachCriticalImpactIndicator(rows, candidates)[0].criticalImpactIndicator).toBeNull()
  })
})

describe("matchesCriticalFilter", () => {
  it("'all' matches every row", () => {
    expect(matchesCriticalFilter({ criticalImpactIndicator: null }, "all")).toBe(true)
    expect(matchesCriticalFilter({ criticalImpactIndicator: true }, "all")).toBe(true)
  })

  it("'unknown' matches only null", () => {
    expect(matchesCriticalFilter({ criticalImpactIndicator: null }, "unknown")).toBe(true)
    expect(matchesCriticalFilter({ criticalImpactIndicator: false }, "unknown")).toBe(false)
  })

  it("'yes'/'no' match true/false and exclude unknown", () => {
    expect(matchesCriticalFilter({ criticalImpactIndicator: true }, "yes")).toBe(true)
    expect(matchesCriticalFilter({ criticalImpactIndicator: false }, "yes")).toBe(false)
    expect(matchesCriticalFilter({ criticalImpactIndicator: null }, "no")).toBe(false)
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
  it("exports exactly the rows it was given (the caller's already-filtered set)", () => {
    const rows = attachCriticalImpactIndicator([watchRow({ material: "A" }), watchRow({ material: "B" })], [
      candidate({ material: "A", criticalImpactIndicator: true }),
    ])
    const csv = nonMoverRowsToCsv(rows)
    expect(csv).toHaveLength(2)
    expect(csv[0][0]).toBe("A")
    expect(csv[0][csv[0].length - 1]).toBe("Yes")
    expect(csv[1][csv[1].length - 1]).toBe("Unknown")
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
