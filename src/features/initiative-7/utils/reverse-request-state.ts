// What a Min-Max to OAR conversion request looks like on screen: its status in words, where it is in the chain,
// and which approval actions the signed-in person may take. Pure, so it is tested without a browser.
//
// The rules themselves (who may act, no skipping a stage, a comment for reject / send back / hold) belong to
// the backend's approval state machine; this only decides what to offer so the buttons match what it will allow.

import type { ReverseRequestAction } from "@/features/initiative-7/services/reverse-conversion-requests-api"

export type ReverseRequestStatus = "PENDING_APPROVAL" | "SENT_BACK" | "HELD" | "REJECTED" | "SAP_EXECUTION_PENDING" | string

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  SENT_BACK: "Sent back",
  HELD: "On hold",
  REJECTED: "Rejected",
  SAP_EXECUTION_PENDING: "Approved",
}

/** The status in the words a planner reads. An unknown status is shown as the backend sent it. */
export function requestStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

export type StatusTone = "success" | "warning" | "danger" | "default"

export function requestStatusTone(status: string): StatusTone {
  if (status === "SAP_EXECUTION_PENDING") return "success"
  if (status === "REJECTED") return "danger"
  if (status === "PENDING_APPROVAL" || status === "SENT_BACK" || status === "HELD") return "warning"
  return "default"
}

/** True while a request is in the chain, or fully approved and waiting for SAP: another cannot be raised. */
export function isRequestOpen(status: string | null | undefined): boolean {
  return status === "PENDING_APPROVAL" || status === "SENT_BACK" || status === "HELD" || status === "SAP_EXECUTION_PENDING"
}

/** One line for a list row: who the request is waiting for, or how it ended. */
export function requestSummary(status: string, pendingRole: string | null): string {
  if (status === "SAP_EXECUTION_PENDING") return "Approved — SAP change pending"
  if (status === "REJECTED") return "Conversion rejected"
  const label = requestStatusLabel(status)
  return pendingRole ? `${label} · waiting for ${pendingRole}` : label
}

export type StepState = "done" | "current" | "waiting"

export interface ChainStep {
  role: string
  state: StepState
}

/** Each role of the route with whether it has approved, is up now, or is still to come. */
export function chainSteps(route: readonly string[], chainIndex: number, status: string): ChainStep[] {
  const finished = status === "SAP_EXECUTION_PENDING"
  return route.map((role, index) => ({
    role,
    state: finished || index < chainIndex ? "done" : index === chainIndex && status !== "REJECTED" ? "current" : "waiting",
  }))
}

export const NEEDS_COMMENT: readonly ReverseRequestAction[] = ["REJECT", "SEND_BACK", "HOLD"]

export function actionNeedsComment(action: ReverseRequestAction): boolean {
  return NEEDS_COMMENT.includes(action)
}

/** The actions to offer the person acting as ``actingRole``: none unless they hold the pending step. A held
 * request offers only Release hold, as the backend allows nothing else from it. */
export function availableActions(status: string, pendingRole: string | null, actingRole: string): ReverseRequestAction[] {
  if (!pendingRole || pendingRole !== actingRole) return []
  if (status === "HELD") return ["RELEASE_HOLD"]
  if (status === "PENDING_APPROVAL" || status === "SENT_BACK") return ["APPROVE", "SEND_BACK", "HOLD", "REJECT"]
  return []
}

export const ACTION_LABEL: Record<ReverseRequestAction, string> = {
  APPROVE: "Approve",
  SEND_BACK: "Send back",
  HOLD: "Hold",
  REJECT: "Reject",
  RELEASE_HOLD: "Release hold",
}

export const ACTION_DONE: Record<ReverseRequestAction, string> = {
  APPROVE: "Approved",
  SEND_BACK: "Sent back",
  HOLD: "Put on hold",
  REJECT: "Rejected",
  RELEASE_HOLD: "Hold released",
}
