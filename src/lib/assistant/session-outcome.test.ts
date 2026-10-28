import { describe, expect, it } from "vitest"

import type { ApiSessionSummary } from "@/lib/api/assistant"

import {
  declaredCell,
  declaredExportCell,
  i08SessionSummary,
  sessionOutcome,
  wentAheadSessionIds,
} from "./session-outcome"

describe("wentAheadSessionIds", () => {
  it("keeps only new-unit and quantity-override justifications that name a session", () => {
    expect(
      wentAheadSessionIds([
        { sessionId: "S1", kind: "NEW_ACQUISITION" },
        { sessionId: "S2", kind: "QUANTITY_OVERRIDE" },
        { sessionId: null, kind: "NEW_ACQUISITION" },
        { sessionId: "S3", kind: "PLAN_BREACH" },
      ])
    ).toEqual(["S1", "S2"])
  })
})

describe("sessionOutcome", () => {
  const wentAhead = new Set(["S2"])

  it("reads abandoned as not acted on, even with a justification", () => {
    expect(sessionOutcome({ sessionId: "S2", outcome: "ABANDONED" }, wentAhead)).toBe("not-acted")
  })

  it("reads a justified session as went ahead anyway", () => {
    expect(sessionOutcome({ sessionId: "S2", outcome: "COMPLETED" }, wentAhead)).toBe("went-ahead")
  })

  it("reads any other completed session as followed, and an unfinished one as still open", () => {
    expect(sessionOutcome({ sessionId: "S1", outcome: "COMPLETED" }, wentAhead)).toBe("followed")
    expect(sessionOutcome({ sessionId: "S1", outcome: "OPEN" }, wentAhead)).toBe("open")
  })
})

function row(overrides: Partial<ApiSessionSummary> = {}): ApiSessionSummary {
  return {
    sessionId: "S1",
    flow: "i08",
    outcome: "COMPLETED",
    materialId: "8000000007",
    plant: "1300",
    department: "10106",
    requestedFor: "SSJ",
    requester: "UNAUTHENTICATED-FRONTEND",
    origin: "PLATFORM",
    issuedAt: "2026-10-27T11:04:29Z",
    expiresAt: "2026-10-30T11:04:29Z",
    turns: 5,
    linkedReservations: [],
    ...overrides,
  }
}

describe("declaredCell", () => {
  it("says what was declared on a repairable row", () => {
    expect(declaredCell(row({ declared: true, declarationRecommendation: "BEYOND_ECONOMICAL_REPAIR" }))).toEqual({
      kind: "yes",
      text: "Beyond economical repair",
    })
    expect(declaredCell(row({ declared: true, declarationRecommendation: null }))).toEqual({ kind: "yes", text: "Declared" })
    expect(declaredCell(row({ declared: false }))).toEqual({ kind: "no" })
  })

  it("never claims no on an older backend, and has nothing to say for OAR", () => {
    expect(declaredCell(row())).toEqual({ kind: "unknown" })
    expect(declaredCell(row({ flow: "i13", declared: false }))).toEqual({ kind: "na" })
  })

  it("exports a plain cell", () => {
    expect(declaredExportCell(row({ declared: true, declarationRecommendation: "REPAIRABLE" }))).toBe("Yes, repairable")
    expect(declaredExportCell(row({ declared: false }))).toBe("No")
    expect(declaredExportCell(row())).toBe("")
    expect(declaredExportCell(row({ flow: "i13" }))).toBe("")
  })
})

describe("i08SessionSummary", () => {
  const link = {
    reservationNumber: "0000123",
    reservationItem: "0001",
    material: "8000000007",
    plant: "1300",
    source: "SGTXT",
    sgtxt: "R3D2KEMVAR",
    firstSeenAt: "2026-10-28T08:00:00Z",
  }

  it("counts the repairable sessions only", () => {
    const sessions = [
      row({ sessionId: "A", declared: true }),
      row({ sessionId: "B", declared: false, linkedReservations: [link] }),
      row({ sessionId: "C", outcome: "ABANDONED", declared: false }),
      row({ sessionId: "D", flow: "i13", declared: false }),
    ]
    expect(i08SessionSummary(sessions, new Set(["B"]))).toEqual({
      sessions: 3,
      followed: 1,
      wentAhead: 1,
      notActed: 1,
      declared: 1,
      linked: 1,
      notLinked: 2,
    })
  })

  it("leaves a count the backend cannot give yet as null, not zero", () => {
    const old = row({ linkedReservations: undefined })
    expect(i08SessionSummary([old], new Set())).toMatchObject({ declared: null, linked: null, notLinked: null })
  })
})
