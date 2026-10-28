/**
 * Wording shared by the session trace screen and its downloaded file, so the
 * two cannot say different things.
 */

/**
 * How a session is quoted. A line of a multi-material request is shown as
 * `R…/n` but SAP carries the bare `R…` (header text, copied to every item);
 * a stand-alone session is its own session ID for both.
 */
export type SessionIdentity = {
  /** `R…/n` for a request line, the session ID otherwise. */
  label: string
  /** What is typed into SAP: the bare request ID, or the session ID. */
  sapText: string
  requestId: string | null
  lineNo: number | null
}

export function sessionIdentity(trace: {
  sessionId: string
  requestId?: string | null
  lineNo?: number | null
  reference?: string
}): SessionIdentity {
  const requestId = trace.requestId || null
  const lineNo = trace.lineNo ?? null
  const label =
    trace.reference || (requestId && lineNo ? `${requestId}/${lineNo}` : requestId ?? trace.sessionId)
  return { label, sapText: requestId ?? trace.sessionId, requestId, lineNo }
}

/** Display only -- the band is the backend's. */
export const BAND_LABEL: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

/** Why months of cover is blank, in words -- the backend sends a code. */
const COVER_REASON: Record<string, string> = {
  INSUFFICIENT_HISTORY: "not enough consumption history",
}

export function coverReasonText(reason: string): string {
  return COVER_REASON[reason] ?? reason.replace(/_/g, " ").toLowerCase()
}

/** `OPEN` -> `Open`: the plan's status is a code on the wire. */
export function planStatusLabel(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function formatWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${start} to ${end}`
  return start ? `from ${start}` : `by ${end}`
}

export function formatInstant(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
