import type { ApiSessionSummary } from "@/lib/api/assistant"

/**
 * What the session log's Reservation column says about one session, for both
 * flows: the backend links any session whose ID is in a reservation's item
 * text (SGTXT), OAR or Repairable alike.
 *
 * - `unknown` -- the backend did not send `linkedReservations` (one older than
 *   the field). Never shown as "not linked": that would be a claim.
 * - `not-linked` -- no reservation's SGTXT names this session *yet*. The link
 *   appears once the item text is read: the RESB extract and the night
 *   rebuild, or at once through the UAT "Link SAP reservation" panel.
 * - `linked` -- one or more reservation items name it.
 */
export type SessionReservationState =
  | { kind: "unknown" }
  | { kind: "not-linked" }
  | { kind: "linked"; refs: string[]; fromUat: boolean }

export function sessionReservationState(session: ApiSessionSummary): SessionReservationState {
  const links = session.linkedReservations
  if (links === undefined) return { kind: "unknown" }
  if (links.length === 0) return { kind: "not-linked" }
  return {
    kind: "linked",
    refs: links.map((l) => `${l.reservationNumber}/${l.reservationItem}`),
    fromUat: links.some((l) => l.source === "UAT_SGTXT"),
  }
}

/** For the Reservation filter: `linked` / `not-linked` / anything else. */
export function matchesReservationFilter(session: ApiSessionSummary, filter: string): boolean {
  if (filter === "all") return true
  const kind = sessionReservationState(session).kind
  return filter === "linked" ? kind === "linked" : filter === "not-linked" ? kind === "not-linked" : true
}

/** What the search box should also match: each reservation, with and without its item. */
export function reservationSearchTerms(session: ApiSessionSummary): string[] {
  return (session.linkedReservations ?? []).flatMap((l) => [
    `${l.reservationNumber}/${l.reservationItem}`,
    l.reservationNumber,
  ])
}

/** The exported cell: blank when the state is unknown. */
export function reservationExportCell(session: ApiSessionSummary): string {
  const state = sessionReservationState(session)
  if (state.kind === "linked") return state.refs.join(", ") + (state.fromUat ? " (UAT)" : "")
  if (state.kind === "not-linked") return "Not linked"
  return ""
}

/**
 * Where a session's linked reservations open. OAR: the Utilization Ledger's
 * reservations for the session. Repairable: the ledger lists OAR materials
 * only and would be empty, so the session trace, which lists the links.
 */
export function linkedReservationsHref(session: { flow: string; sessionId: string }): string {
  const id = encodeURIComponent(session.sessionId)
  return session.flow === "i13" ? `/oar-utilization/ledger?view=reservations&session=${id}` : `/assistant/sessions/${id}`
}
