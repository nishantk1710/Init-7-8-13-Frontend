import type { IssueMatch } from "@/lib/api/i13"

/**
 * How a PO line's issued quantity was found (backend `stock_issue_matching`).
 *
 * SAP records no PO on a goods issue -- only the reservation it was issued
 * against. So a line's issues are exact only when a reservation raised its PR;
 * stock material (OAR) is bought to refill the shelf, and its issues are
 * counted against the oldest delivery still in stock.
 */
export const ISSUE_MATCH_LABELS: Record<IssueMatch, string> = {
  RESERVATION: "Matched to reservation",
  OLDEST_DELIVERY_FIRST: "Estimated",
  BEFORE_ISSUE_HISTORY: "Before issue history",
}

export const ISSUE_MATCH_EXPLANATIONS: Record<IssueMatch, string> = {
  RESERVATION: "Exact: SAP links these issues to the reservation that raised this PR (RESB-BANFN).",
  OLDEST_DELIVERY_FIRST:
    "Estimated: SAP doesn't record which purchase an issue came from, so this material's issues at this " +
    "plant (MSEG 201/261) are counted against the oldest delivery first.",
  BEFORE_ISSUE_HISTORY:
    "Delivered before the earliest goods movement the system holds, so what was issued from it cannot be seen.",
}

/**
 * Procurement lines end at goods receipt: SAP records a receipt against the PO
 * line and a goods issue against the reservation, never against the PO line.
 */
export const RAISED_BY_RESERVATION_EXPLANATION =
  "This reservation raised the line's PR (RESB-BANFN). Its goods issues are recorded against the reservation, " +
  "on the Reservations tab."

export const STOCK_REFILL_EXPLANATION =
  "Stock refill: no reservation raised this line. The delivery went into the material's shared stock at this " +
  "plant, and SAP records goods issues against reservations, not against PO lines -- see the Reservations tab " +
  "for what was issued."

/** Hover text for the next planned issue: where the date comes from. */
export const NEXT_PLANNED_ISSUE_TITLE =
  "Requirement date (RESB-BDTER) of the earliest open reservation expected to draw on this line's stock"
