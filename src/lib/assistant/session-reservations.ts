import type { ApiSessionSummary } from "@/lib/api/assistant"

/**
 * What the session log's Reservation column says about one session.
 *
 * - `not-applicable` -- a Repairable Spares session: those are not linked to a
 *   reservation through its item text (SGTXT), so there is nothing to show.
 * - `unknown` -- the backend did not send `linkedReservations` (one older than
 *   the field). Never shown as "not linked": that would be a claim.
 * - `not-linked` -- no reservation's SGTXT names this session *yet*. The link
 *   appears once the item text is read: the RESB extract and the night
 *   rebuild, or at once through the UAT "Link SAP reservation" panel.
 * - `linked` -- one or more reservation items name it.
 */
export type SessionReservationState =
  | { kind: "not-applicable" }
  | { kind: "unknown" }
  | { kind: "not-linked" }
  | { kind: "linked"; refs: string[]; fromUat: boolean }

export function sessionReservationState(session: ApiSessionSummary): SessionReservationState {
  if (session.flow !== "i13") return { kind: "not-applicable" }
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

/** The exported cell: blank for a repairable session or an unknown state. */
export function reservationExportCell(session: ApiSessionSummary): string {
  const state = sessionReservationState(session)
  if (state.kind === "linked") return state.refs.join(", ") + (state.fromUat ? " (UAT)" : "")
  if (state.kind === "not-linked") return "Not linked"
  return ""
}
