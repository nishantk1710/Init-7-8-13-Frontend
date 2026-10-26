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
