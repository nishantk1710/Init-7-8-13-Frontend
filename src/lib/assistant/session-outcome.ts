// What came of a session, for the log's Outcome column and filter. Read from
// two things the sessions page already loads: the session's own status, and
// whether a "went ahead anyway" justification was recorded against it.

import type { ApiJustification, ApiSessionSummary } from "@/lib/api/assistant"

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
