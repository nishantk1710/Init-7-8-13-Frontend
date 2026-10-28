// What came of a session, for the log's Outcome column and filter. Read from
// two things the sessions page already loads: the session's own status, and
// whether a "went ahead anyway" justification was recorded against it.

import type { ApiJustification, ApiSessionSummary } from "@/lib/api/assistant"
import { sessionReservationState } from "@/lib/assistant/session-reservations"
import { recommendationLabel } from "@/lib/assistant/session-view"

export type SessionOutcome = "followed" | "went-ahead" | "not-acted" | "open"

export const SESSION_OUTCOME_LABEL: Record<SessionOutcome, string> = {
  followed: "Followed advice",
  "went-ahead": "Went ahead anyway",
  "not-acted": "Not acted on",
  open: "Still open",
}

/** The justifications that mean "told otherwise, and proceeded": a new unit when one exists, or a quantity override. */
export function wentAheadSessionIds(justifications: Pick<ApiJustification, "sessionId" | "kind">[]): string[] {
  return justifications
    .filter((j) => j.sessionId && (j.kind === "NEW_ACQUISITION" || j.kind === "QUANTITY_OVERRIDE"))
    .map((j) => j.sessionId as string)
}

export function sessionOutcome(
  session: Pick<ApiSessionSummary, "sessionId" | "outcome">,
  wentAhead: ReadonlySet<string>
): SessionOutcome {
  if (session.outcome === "ABANDONED") return "not-acted"
  if (wentAhead.has(session.sessionId)) return "went-ahead"
  if (session.outcome === "COMPLETED") return "followed"
  return "open"
}

/**
 * The list's Declared cell. Only a repairable session can declare a faulty
 * unit, so an OAR row has nothing to say (`na`). `unknown` is a backend older
 * than the field: never shown as "no", which would be a claim.
 */
export type DeclaredCell = { kind: "na" } | { kind: "unknown" } | { kind: "no" } | { kind: "yes"; text: string }

export function declaredCell(
  session: Pick<ApiSessionSummary, "flow" | "declared" | "declarationRecommendation">
): DeclaredCell {
  if (session.flow !== "i08") return { kind: "na" }
  if (session.declared === undefined) return { kind: "unknown" }
  if (!session.declared) return { kind: "no" }
  return {
    kind: "yes",
    text: session.declarationRecommendation ? recommendationLabel(session.declarationRecommendation) : "Declared",
  }
}

/** The Declared column in the Excel export: blank where there is nothing to say. */
export function declaredExportCell(session: Pick<ApiSessionSummary, "flow" | "declared" | "declarationRecommendation">): string {
  const cell = declaredCell(session)
  if (cell.kind === "yes") return `Yes, ${cell.text.toLowerCase()}`
  return cell.kind === "no" ? "No" : ""
}

/**
 * The four cards the sessions page shows for repairable sessions. A count the
 * backend cannot give yet (`declared` on an older backend, links on one older
 * than the field) is null, never zero.
 */
export type I08SessionSummary = {
  sessions: number
  followed: number
  wentAhead: number
  notActed: number
  declared: number | null
  linked: number | null
  notLinked: number | null
}

export function i08SessionSummary(
  sessions: readonly ApiSessionSummary[],
  wentAhead: ReadonlySet<string>
): I08SessionSummary {
  const i08 = sessions.filter((s) => s.flow === "i08")
  const outcomes = i08.map((s) => sessionOutcome(s, wentAhead))
  const count = (o: SessionOutcome) => outcomes.filter((x) => x === o).length
  const declaredKnown = i08.some((s) => s.declared !== undefined)
  const links = i08.map((s) => sessionReservationState(s).kind)
  const linksKnown = links.some((k) => k !== "unknown")
  return {
    sessions: i08.length,
    followed: count("followed"),
    wentAhead: count("went-ahead"),
    notActed: count("not-acted"),
    declared: declaredKnown ? i08.filter((s) => s.declared === true).length : null,
    linked: linksKnown ? links.filter((k) => k === "linked").length : null,
    notLinked: linksKnown ? links.filter((k) => k === "not-linked").length : null,
  }
}
