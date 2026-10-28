/**
 * "Delivered on" for a ledger line: the goods-receipt date, always paired with
 * a status so a partial delivery is never read as a complete one.
 *
 * The status comes from quantities (received vs ordered), never from the
 * dates. The backend's GR dates skip reversal rows but still include the 101
 * they reversed, so a fully reversed receipt has a date and zero received --
 * that line must read "Not delivered", and only the quantities can say so.
 *
 * A line nothing more will arrive on is neither: SAP closed it (delivery
 * completed, deleted, blocked) or it was never an order (a contract or a request
 * for quotation) -- the backend decides which (UAT, 23 Oct).
 *
 * A line not (fully) delivered also carries when the rest is expected:
 * EKET-EINDT of its PO line's next open schedule line (UAT, 21 Oct), and
 * whether that date has already passed.
 */

import type { ProcurementStatus } from "@/lib/api/i13"

export type DeliveryState = "DELIVERED" | "PARTIAL" | "NOT_DELIVERED" | "CLOSED" | "NOT_AN_ORDER" | "NO_PO"

export interface DeliveryStatus {
  state: DeliveryState
  /** Shown date: the latest receipt (completion date when fully delivered). */
  date: string | null
  /** Earliest receipt, for the tooltip when there were several. */
  firstDate: string | null
  /** EKET-EINDT for what is still to come; only on NOT_DELIVERED and PARTIAL. */
  expectedDate: string | null
  /** The expected date is before today and the line is still not fully delivered. */
  overdue: boolean
}

/** Today as `YYYY-MM-DD` (UTC, the backend's dates are plain dates). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function withExpected(
  status: Omit<DeliveryStatus, "expectedDate" | "overdue">,
  expectedDeliveryDate: string | null | undefined,
  today: string
): DeliveryStatus {
  const open = status.state === "NOT_DELIVERED" || status.state === "PARTIAL"
  const expectedDate = open ? (expectedDeliveryDate ?? null) : null
  return { ...status, expectedDate, overdue: expectedDate !== null && expectedDate < today }
}

export interface DeliveryInput {
  hasPo: boolean
  receivedQuantity: number | null
  /** Null when the backend does not know the ordered quantity. */
  orderedQuantity: number | null
  firstGrDate: string | null
  latestGrDate: string | null
  expectedDeliveryDate?: string | null
}

/**
 * Same rule as the backend's `_procurement_status` (ledger_compat.py): nothing
 * received is open, less than ordered is partial, otherwise received -- an
 * unknown ordered quantity cannot make a receipt partial.
 */
export function deliveryStatus(input: DeliveryInput, today: string = todayIso()): DeliveryStatus {
  return withExpected(receiptStatus(input), input.expectedDeliveryDate, today)
}

function receiptStatus(input: DeliveryInput): Omit<DeliveryStatus, "expectedDate" | "overdue"> {
  const firstDate = input.firstGrDate ?? input.latestGrDate
  const date = input.latestGrDate ?? input.firstGrDate
  if (!input.hasPo) return { state: "NO_PO", date: null, firstDate: null }
  const received = input.receivedQuantity ?? 0
  if (received <= 0) return { state: "NOT_DELIVERED", date: null, firstDate: null }
  if (input.orderedQuantity && received < input.orderedQuantity) {
    return { state: "PARTIAL", date, firstDate }
  }
  return { state: "DELIVERED", date, firstDate }
}

/** The lines view gets the backend's procurement status instead of the ordered quantity. */
export function deliveryStatusFromProcurement(
  input: {
    hasPo: boolean
    procurementStatus: ProcurementStatus
    firstGrDate: string | null
    latestGrDate: string | null
    expectedDeliveryDate?: string | null
  },
  today: string = todayIso()
): DeliveryStatus {
  return withExpected(procurementReceipt(input), input.expectedDeliveryDate, today)
}

function procurementReceipt(input: {
  hasPo: boolean
  procurementStatus: ProcurementStatus
  firstGrDate: string | null
  latestGrDate: string | null
}): Omit<DeliveryStatus, "expectedDate" | "overdue"> {
  const firstDate = input.firstGrDate ?? input.latestGrDate
  const date = input.latestGrDate ?? input.firstGrDate
  if (!input.hasPo) return { state: "NO_PO", date: null, firstDate: null }
  switch (input.procurementStatus) {
    case "OPEN":
      return { state: "NOT_DELIVERED", date: null, firstDate: null }
    case "PARTIALLY_RECEIVED":
      return { state: "PARTIAL", date, firstDate }
    case "RECEIVED":
      return { state: "DELIVERED", date, firstDate }
    case "CLOSED":
    case "NOT_AN_ORDER":
      // A short-closed line keeps the date of what did arrive.
      return { state: input.procurementStatus, date, firstDate }
  }
}

/** Filter labels, in the order a reader expects them; the cell's wording. */
export const DELIVERY_STATE_LABELS: Record<DeliveryState, string> = {
  DELIVERED: "Delivered",
  PARTIAL: "Partially received",
  NOT_DELIVERED: "Not delivered",
  CLOSED: "Closed in SAP",
  NOT_AN_ORDER: "Not an order",
  NO_PO: "No PO yet",
}

/** Hover text for the two states a reader will not guess from the label. */
export const DELIVERY_STATE_EXPLANATIONS: Partial<Record<DeliveryState, string>> = {
  CLOSED:
    "SAP has closed this PO line -- delivery completed (EKPO-ELIKZ) or deleted/blocked (EKPO-LOEKZ) -- so nothing more will be delivered on it, whatever was not received.",
  NOT_AN_ORDER:
    "Not an order: a contract or a request for quotation (EKKO-BSART), or a line ordering nothing. Goods arrive on separate purchase orders, never on this line.",
}

/** The procurement-status filter and badge wording. */
export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  OPEN: "Open",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CLOSED: "Closed in SAP",
  NOT_AN_ORDER: "Not an order",
}
