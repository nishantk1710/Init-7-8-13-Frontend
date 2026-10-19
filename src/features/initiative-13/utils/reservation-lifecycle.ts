/**
 * What the Reservations view says about a reservation's lifecycle.
 *
 * Five stages in the order things happen, so a business user reads one simple
 * flow: **Reserved -> PR raised -> PO raised -> Received -> Issued**, with
 * "Partly" where only some of the quantity got there. The backend keeps the
 * precise value (`lifecycle_status`); the cases a user does not need as a
 * status of their own -- a PR that cannot be traced, or one several
 * reservations share -- are still "PR raised" (SAP says a PR exists) and are
 * explained on hover. Nothing here claims a step the data does not show: a
 * reservation with no requisition is **Reserved**, never "PR raised".
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
    label: "PR raised",
    explanation:
      "The reservation names a purchase requisition, but that PR is not in the data the platform holds (another plant, older than the 3-year extract, or deleted), so its PO and receipts cannot be shown.",
    tone: "default",
  },
  PR_SHARED: {
    label: "PR raised",
    explanation:
      "The reservation names a purchase requisition that other reservations also name, so its PO and receipts cannot be attributed to this one.",
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
    explanation: "Part of the quantity has been issued to the job.",
    tone: "warning",
  },
  ISSUED: {
    label: "Issued",
    explanation: "Fully issued to the job (from a receipt, or straight from stock).",
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
