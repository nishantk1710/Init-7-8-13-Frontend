import { describe, expect, it } from "vitest"

import type { ApiLinkedReservation, ApiSessionSummary } from "@/lib/api/assistant"
import {
  linkedReservationsHref,
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
  it("reads a repairable session's links like an OAR one", () => {
    expect(sessionReservationState(session({ flow: "i08" }))).toEqual({ kind: "not-linked" })
    expect(
      sessionReservationState(session({ flow: "i08", sessionId: "SW3JPZV37R", linkedReservations: [link("2038856", "1")] }))
    ).toEqual({ kind: "linked", refs: ["2038856/1"], fromUat: false })
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
  const repairableLinked = session({ flow: "i08", linkedReservations: [link("2038856", "1")] })
  const repairableNotLinked = session({ flow: "i08" })
  const all = [linked, notLinked, repairableLinked, repairableNotLinked]

  it("keeps everything on All", () => {
    expect(all.every((s) => matchesReservationFilter(s, "all"))).toBe(true)
  })

  it("splits linked from not linked, for both flows", () => {
    expect(all.filter((s) => matchesReservationFilter(s, "linked"))).toEqual([linked, repairableLinked])
    expect(all.filter((s) => matchesReservationFilter(s, "not-linked"))).toEqual([notLinked, repairableNotLinked])
  })
})

describe("search and export", () => {
  it("finds a session by its reservation number, with or without the item", () => {
    expect(reservationSearchTerms(session({ linkedReservations: [link("1061840", "1")] }))).toEqual([
      "1061840/1",
      "1061840",
    ])
  })

  it("exports the references, 'Not linked', or blank when unknown", () => {
    expect(reservationExportCell(session({ linkedReservations: [link("1061840", "1", "UAT_SGTXT")] }))).toBe(
      "1061840/1 (UAT)"
    )
    expect(reservationExportCell(session())).toBe("Not linked")
    expect(reservationExportCell(session({ flow: "i08" }))).toBe("Not linked")
    expect(reservationExportCell(session({ linkedReservations: undefined }))).toBe("")
  })

  it("opens OAR links in the ledger and repairable ones on the trace", () => {
    expect(linkedReservationsHref({ flow: "i13", sessionId: "S7K2M9QX4P" })).toBe(
      "/oar-utilization/ledger?view=reservations&session=S7K2M9QX4P"
    )
    expect(linkedReservationsHref({ flow: "i08", sessionId: "SW3JPZV37R" })).toBe("/assistant/sessions/SW3JPZV37R")
  })
})
