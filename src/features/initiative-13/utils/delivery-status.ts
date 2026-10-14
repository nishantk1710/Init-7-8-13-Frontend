/**
 * "Delivered on" for a ledger line: the goods-receipt date, always paired with
 * a status so a partial delivery is never read as a complete one.
 *
 * The status comes from quantities (received vs ordered), never from the
 * dates. The backend's GR dates skip reversal rows but still include the 101
 * they reversed, so a fully reversed receipt has a date and zero received --
 * that line must read "Not delivered", and only the quantities can say so.
 */

export type DeliveryState = "DELIVERED" | "PARTIAL" | "NOT_DELIVERED" | "NO_PO"

export interface DeliveryStatus {
  state: DeliveryState
  /** Shown date: the latest receipt (completion date when fully delivered). */
  date: string | null
  /** Earliest receipt, for the tooltip when there were several. */
  firstDate: string | null
}

export interface DeliveryInput {
  hasPo: boolean
  receivedQuantity: number | null
  /** Null when the backend does not know the ordered quantity. */
  orderedQuantity: number | null
  firstGrDate: string | null
  latestGrDate: string | null
}

/**
 * Same rule as the backend's `_procurement_status` (ledger_compat.py): nothing
 * received is open, less than ordered is partial, otherwise received -- an
 * unknown ordered quantity cannot make a receipt partial.
 */
export function deliveryStatus(input: DeliveryInput): DeliveryStatus {
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
export function deliveryStatusFromProcurement(input: {
  hasPo: boolean
  procurementStatus: "OPEN" | "PARTIALLY_RECEIVED" | "RECEIVED"
  firstGrDate: string | null
  latestGrDate: string | null
}): DeliveryStatus {
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
  }
}
