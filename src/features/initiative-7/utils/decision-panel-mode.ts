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
