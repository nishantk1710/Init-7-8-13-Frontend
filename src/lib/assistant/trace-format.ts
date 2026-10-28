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
  if (start && end) return `${formatDay(start)} to ${formatDay(end)}`
  return start ? `from ${formatDay(start)}` : `by ${formatDay(end)}`
}

// --- dates ------------------------------------------------------------------
//
// One format on every assistant screen, the same as the Repairable Spares
// screens: `27 Oct 2026`, and with a time `27 Oct 2026, 13:04`. Times are
// South African: the pages render on a server running in UTC, and a time
// without a zone would be two hours out for everyone reading it at a mine.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const ZONE = "Africa/Johannesburg"
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const pad = (value: number) => String(value).padStart(2, "0")

function local(timestamp: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(parsed)
      .map((part) => [part.type, part.value])
  )
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), hh: Number(parts.hour), mm: Number(parts.minute) }
}

/**
 * `2026-10-27` or a full timestamp as `27 Oct 2026`. A bare date is a calendar
 * date and is never moved by a time zone. Anything unreadable is shown as sent.
 */
export function formatDay(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  const plain = DATE_ONLY.exec(value)
  if (plain) {
    const month = Number(plain[2])
    if (month < 1 || month > 12) return value
    return `${plain[3]} ${MONTHS[month - 1]} ${plain[1]}`
  }
  const at = local(value)
  return at ? `${pad(at.d)} ${MONTHS[at.m - 1]} ${at.y}` : value
}

/** A timestamp as `27 Oct 2026, 13:04`, South African time. A bare date stays a date. */
export function formatInstant(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  if (DATE_ONLY.test(value)) return formatDay(value, fallback)
  const at = local(value)
  return at ? `${pad(at.d)} ${MONTHS[at.m - 1]} ${at.y}, ${pad(at.hh)}:${pad(at.mm)}` : value
}
