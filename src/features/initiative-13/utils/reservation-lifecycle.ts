/**
 * What the Reservations view says about a reservation's lifecycle.
 *
 * The backend's value is an enum (`lifecycle_status`); this turns it into a
 * label and a sentence saying what it means, so a row never claims more than
 * the data shows. In particular a reservation with no purchase requisition is
 * **Reserved (no PR)**, not "PR created": most reservations name no PR at all
 * (SAP field RESB-BANFN is empty on ~99% of them).
 */

type Tone = "default" | "success" | "warning"

export type LifecycleView = { label: string; explanation: string; tone: Tone }

const VIEWS: Record<string, LifecycleView> = {
  RESERVED: {
    label: "Reserved (no PR)",
    explanation:
      "The reservation names no purchase requisition (its PR field in SAP is empty): a reservation against stock, or a PR raised without the reservation's reference.",
    tone: "default",
  },
  PR_NOT_FOUND: {
    label: "PR not found",
    explanation: "The reservation names a purchase requisition that the loaded PR extract does not contain.",
    tone: "warning",
  },
  PR_SHARED: {
    label: "PR shared",
    explanation:
      "Several reservations name the same PR item, so its PO and receipts cannot be attributed to any one of them.",
    tone: "warning",
  },
  PR_CREATED: {
    label: "PR created",
    explanation: "A purchase requisition exists for this reservation; no purchase order yet.",
    tone: "default",
  },
  ORDERED: { label: "Ordered", explanation: "A purchase order exists; nothing received yet.", tone: "default" },
  PARTIALLY_RECEIVED: {
    label: "Partially received",
    explanation: "Part of the ordered quantity has been received.",
    tone: "warning",
  },
  RECEIVED: { label: "Received", explanation: "Received; nothing issued yet.", tone: "default" },
  PARTIALLY_ISSUED: {
    label: "Partially issued",
    explanation: "Part of the quantity has been issued.",
    tone: "warning",
  },
  ISSUED: { label: "Issued", explanation: "Fully issued (from a receipt, or straight from stock).", tone: "success" },
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
