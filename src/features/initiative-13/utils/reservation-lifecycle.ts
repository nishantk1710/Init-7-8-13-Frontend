/**
 * What the Reservations view says about a reservation's lifecycle.
 *
 * Five stages in the order things happen, so a business user reads one simple
 * flow: **Reserved -> PR raised -> PO raised -> Received -> Issued**, with
 * "Partly" where only some of the quantity got there. The backend keeps the
 * precise value (`lifecycle_status`). Where a PR is named but its progress
 * cannot be seen -- not in the extract, or shared by several reservations --
 * the label is **PR – status unknown**, never "PR raised": that would claim no
 * PO exists, when it may already be ordered or received. The hover says why.
 * Nothing here claims a step the data does not show: a reservation with no
 * requisition is **Reserved**.
 */

type Tone = "default" | "success" | "warning"

export type LifecycleView = { label: string; explanation: string; tone: Tone }

const VIEWS: Record<string, LifecycleView> = {
  RESERVED: {
    label: "Reserved",
    explanation:
      "Reservation only: no purchase requisition is linked to it (its PR field in SAP is empty). Typically a reservation against stock.",
    tone: "default",
  },
  PR_CREATED: {
    label: "PR raised",
    explanation: "A purchase requisition exists for this reservation; no purchase order yet.",
    tone: "default",
  },
  PR_NOT_FOUND: {
    label: "PR – status unknown",
    explanation:
      "A purchase requisition is named on the reservation, but it is not in the data the platform holds (another plant, older than the 3-year extract, or deleted). It may already be ordered or received; the platform cannot see how far it got.",
    tone: "default",
  },
  PR_SHARED: {
    label: "PR – status unknown",
    explanation:
      "A purchase requisition is named on the reservation, but other reservations name the same PR, so its PO and receipts cannot be attributed to this one. It may already be ordered or received; the platform cannot tell for this reservation.",
    tone: "default",
  },
  PR_DELETED: {
    label: "PR deleted in SAP",
    explanation:
      "The purchase requisition named on this reservation was deleted in SAP (EBAN-LOEKZ = X) before any purchase order was placed on it. Nothing will be ordered or received against it.",
    tone: "default",
  },
  ORDERED: {
    label: "PO raised",
    explanation: "A purchase order has been placed; nothing received yet.",
    tone: "default",
  },
  PARTIALLY_RECEIVED: {
    label: "Partly received",
    explanation: "Part of the ordered quantity has been received.",
    tone: "warning",
  },
  RECEIVED: {
    label: "Received",
    explanation: "Goods received; nothing issued to the job yet.",
    tone: "default",
  },
  PARTIALLY_ISSUED: {
    label: "Partly issued",
    explanation:
      "Part of the quantity has been issued to the job. With no PR on the reservation, it came straight from stock: no purchase was needed.",
    tone: "warning",
  },
  ISSUED: {
    label: "Issued",
    explanation:
      "Fully issued to the job. With no PR on the reservation, it came straight from stock: no purchase was needed.",
    tone: "success",
  },
}

export function lifecycleView(status: string): LifecycleView {
  return (
    VIEWS[status] ?? {
      label: status.replaceAll("_", " ").toLowerCase(),
      explanation: "",
      tone: "default",
    }
  )
}

/** The backend's lifecycle values, in the order things happen -- the Status filter's options. */
export const RESERVATION_STATUSES = [
  "RESERVED",
  "PR_CREATED",
  "PR_NOT_FOUND",
  "PR_SHARED",
  "PR_DELETED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "PARTIALLY_ISSUED",
  "ISSUED",
] as const

/**
 * The Status filter's option names. The pills call both PR_NOT_FOUND and
 * PR_SHARED "PR – status unknown" (the hover tells them apart); a list of
 * options cannot rely on hover, so here they say which.
 */
export function reservationStatusOption(status: string): string {
  if (status === "PR_NOT_FOUND") return "PR – not in the data"
  if (status === "PR_SHARED") return "PR – shared by several reservations"
  return lifecycleView(status).label
}

export const ISSUED_FILTERS = ["NOT_ISSUED", "PARTIALLY_ISSUED", "FULLY_ISSUED"] as const
export type IssuedFilter = (typeof ISSUED_FILTERS)[number]

export const ISSUED_FILTER_LABELS: Record<IssuedFilter, string> = {
  NOT_ISSUED: "Not issued",
  PARTIALLY_ISSUED: "Partly issued",
  FULLY_ISSUED: "Fully issued",
}

/** Which lifecycle values each Issued choice keeps: an issue is the last step, so "not issued" is every status before it. */
const ISSUED_STATUSES: Record<IssuedFilter, readonly string[]> = {
  NOT_ISSUED: RESERVATION_STATUSES.filter((s) => s !== "PARTIALLY_ISSUED" && s !== "ISSUED"),
  PARTIALLY_ISSUED: ["PARTIALLY_ISSUED"],
  FULLY_ISSUED: ["ISSUED"],
}

/**
 * The backend's `lifecycle_status` for the Status and Issued filters together:
 * the statuses both allow, comma-separated. `undefined` when neither is set.
 * When they cannot both hold (Status "Reserved", Issued "Fully issued") it
 * names a value the backend does not know, which matches nothing -- an empty
 * table is the honest answer to that pair.
 */
export function reservationStatusQuery(status?: string, issued?: string): string | undefined {
  const byStatus = status && (RESERVATION_STATUSES as readonly string[]).includes(status) ? [status] : null
  const byIssued = issued && issued in ISSUED_STATUSES ? ISSUED_STATUSES[issued as IssuedFilter] : null
  if (!byStatus && !byIssued) return undefined
  const both = (byStatus ?? RESERVATION_STATUSES).filter((s) => !byIssued || byIssued.includes(s))
  return both.length ? both.join(",") : "NONE"
}

/**
 * The Issued cell's hover text when the quantity is not known: the reservation
 * was required before the earliest goods movement the platform holds, so an
 * issue would predate the data. `null` when the issued quantity is known.
 */
export function issuedUnknownReason(row: {
  issuedBeforeHistory?: boolean
  movementHistoryStart?: string | null
}): string | null {
  if (!row.issuedBeforeHistory) return null
  const from = row.movementHistoryStart ? ` (from ${formatDay(row.movementHistoryStart)})` : ""
  return `Not known: this reservation was required before the goods-movement history the platform holds${from}, so any issue against it would predate the data.`
}

function formatDay(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}
