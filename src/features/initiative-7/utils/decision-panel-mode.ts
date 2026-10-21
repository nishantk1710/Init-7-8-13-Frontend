// What the decision panel on a live recommendation should show, from the backend's own
// workflow state.
//
// The panel used to be handed the *display* status ("Pending Review") and compare it with
// backend words ("NOT_EVALUABLE", "REJECTED"), which never matched. A recommendation that had
// not been calculated, so had never been submitted and had no approver waiting, then fell
// through to "Chain complete". Everything here reads the raw backend status instead.

/** Statuses that mean an approval chain was actually finished and approved. */
const CHAIN_COMPLETE_STATUSES = new Set([
  "APPROVED",
  "SAP_EXECUTION_PENDING",
  "SAP_EXECUTED",
  "ADOPTED",
  "PARTIALLY_ADOPTED",
  "NOT_ADOPTED",
])

export type DecisionPanelMode =
  /** Nothing was calculated, so there is nothing to approve. */
  | "not-reviewable"
  /** Calculated, not yet sent into the approval chain. */
  | "ready-to-submit"
  /** Someone is waiting to decide. */
  | "awaiting-approval"
  | "rejected"
  /** Every approver in the chain approved it. */
  | "chain-complete"
  /** No approver is waiting and the chain did not finish -- never claimed as complete. */
  | "no-pending-step"

export function decisionPanelMode(rawStatus: string, pendingRole: string | null): DecisionPanelMode {
  if (rawStatus === "NOT_EVALUABLE") return "not-reviewable"
  if (rawStatus === "READY_FOR_REVIEW") return "ready-to-submit"
  if (rawStatus === "REJECTED") return "rejected"
  if (pendingRole !== null) return "awaiting-approval"
  if (CHAIN_COMPLETE_STATUSES.has(rawStatus)) return "chain-complete"
  return "no-pending-step"
}

/** Where the decision panel is shown. A recommendation page only **sends** a recommendation for approval;
 * the Action Center is where it is **decided** (approve, adjust, send back, hold, reject). */
export type DecisionSurface = "recommendation" | "action-center"

export type PanelContent =
  | "not-reviewable"
  /** The Send for approval button. */
  | "submit-button"
  /** On the Action Center: an unsubmitted item has nothing to decide yet. */
  | "not-submitted-note"
  /** On a recommendation page after sending: where it is, and that it is decided in the Action Center. */
  | "sent-notice"
  /** The approval buttons (Approve, Adjust, Send back, Hold, Release hold, Reject). */
  | "decision-controls"
  | "rejected"
  | "chain-complete"
  | "no-pending-step"

/** What the panel shows for a state on a surface. Approval buttons exist only on the Action Center. */
export function panelContentFor(mode: DecisionPanelMode, surface: DecisionSurface): PanelContent {
  switch (mode) {
    case "ready-to-submit":
      return surface === "recommendation" ? "submit-button" : "not-submitted-note"
    case "awaiting-approval":
      return surface === "action-center" ? "decision-controls" : "sent-notice"
    default:
      return mode
  }
}
