import { describe, expect, it } from "vitest"

import type { ApiLinkedReservation, ApiSessionSummary } from "@/lib/api/assistant"
import {
  matchesReservationFilter,
  reservationExportCell,
  reservationSearchTerms,
  sessionReservationState,
} from "@/lib/assistant/session-reservations"

function session(overrides: Partial<ApiSessionSummary> = {}): ApiSessionSummary {
  return {
    sessionId: "S7K2M9QX4P",
    flow: "i13",
    outcome: "COMPLETED",
    materialId: "5000017773",
    plant: "1300",
    department: "10100",
    requestedFor: "Bob",
    requester: "coordinator",
    origin: "PLATFORM",
    issuedAt: "2026-10-17T08:00:00Z",
    expiresAt: "2026-10-20T08:00:00Z",
    turns: 4,
    linkedReservations: [],
    ...overrides,
  }
}

function link(number: string, item: string, source = "SGTXT"): ApiLinkedReservation {
  return {
    reservationNumber: number,
    reservationItem: item,
    material: "5000017773",
    plant: "1300",
    source,
    sgtxt: "S7K2M9QX4P",
    firstSeenAt: "2026-10-18T01:00:00Z",
  }
}

describe("sessionReservationState", () => {
  it("is not applicable to a repairable session", () => {
    expect(sessionReservationState(session({ flow: "i08" }))).toEqual({ kind: "not-applicable" })
  })

  it("is unknown when the backend sends no field, never 'not linked'", () => {
    expect(sessionReservationState(session({ linkedReservations: undefined }))).toEqual({ kind: "unknown" })
  })

  it("is not linked when no reservation names the session yet", () => {
    expect(sessionReservationState(session())).toEqual({ kind: "not-linked" })
  })

  it("lists every linked item and flags a UAT link", () => {
    const state = sessionReservationState(
      session({ linkedReservations: [link("1061840", "1"), link("1061840", "2", "UAT_SGTXT")] })
    )
    expect(state).toEqual({ kind: "linked", refs: ["1061840/1", "1061840/2"], fromUat: true })
  })
})

describe("the Reservation filter", () => {
  const linked = session({ linkedReservations: [link("1061840", "1")] })
  const notLinked = session()
  const repairable = session({ flow: "i08" })

  it("keeps everything on All", () => {
    expect([linked, notLinked, repairable].every((s) => matchesReservationFilter(s, "all"))).toBe(true)
  })

  it("splits linked from not linked, leaving repairable sessions out of both", () => {
    expect([linked, notLinked, repairable].filter((s) => matchesReservationFilter(s, "linked"))).toEqual([linked])
    expect([linked, notLinked, repairable].filter((s) => matchesReservationFilter(s, "not-linked"))).toEqual([
      notLinked,
    ])
  })
})

describe("search and export", () => {
  it("finds a session by its reservation number, with or without the item", () => {
    expect(reservationSearchTerms(session({ linkedReservations: [link("1061840", "1")] }))).toEqual([
      "1061840/1",
      "1061840",
    ])
  })

  it("exports the references, 'Not linked', or blank", () => {
    expect(reservationExportCell(session({ linkedReservations: [link("1061840", "1", "UAT_SGTXT")] }))).toBe(
      "1061840/1 (UAT)"
    )
    expect(reservationExportCell(session())).toBe("Not linked")
    expect(reservationExportCell(session({ flow: "i08" }))).toBe("")
  })
})
