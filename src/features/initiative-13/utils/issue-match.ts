import type { IssueMatch, LedgerUtilisationStatus } from "@/lib/api/i13"

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
  OLDEST_DELIVERY_FIRST: "Oldest delivery first",
  BEFORE_ISSUE_HISTORY: "Before issue history",
}

export const ISSUE_MATCH_EXPLANATIONS: Record<IssueMatch, string> = {
  RESERVATION: "SAP records these issues against the reservation that raised this PR (RESB-BANFN).",
  OLDEST_DELIVERY_FIRST:
    "SAP doesn't record which PO a stock issue came from. Issues of this material at this plant " +
    "(MSEG 201/261) are counted against the oldest delivery still in stock first.",
  BEFORE_ISSUE_HISTORY:
    "Delivered before the earliest goods movement the system holds, so what was issued from it cannot be seen.",
}

export const UTILISATION_STATUS_LABELS: Record<LedgerUtilisationStatus, string> = {
  NOT_ISSUED: "Not issued",
  PARTIALLY_ISSUED: "Partially issued",
  FULLY_ISSUED: "Fully issued",
  BEFORE_ISSUE_HISTORY: "Issue history not available",
}

/** Hover text for the next planned issue: where the date comes from. */
export const NEXT_PLANNED_ISSUE_TITLE =
  "Requirement date (RESB-BDTER) of the earliest open reservation expected to draw on this line's stock"
