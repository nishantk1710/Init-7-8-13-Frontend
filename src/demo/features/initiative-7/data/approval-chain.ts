// Fixed 4-step approval chain shared by every recommendation: End User ->
// Engineering Manager -> Commercial Manager -> Warehouse Supervisor. Approver
// names are pulled from the shared USERS list (never invented locally) so
// the chain reads consistently with the rest of the app.

import { USERS } from "@demo/lib/shared-data/users"
import type { WorkflowStep, WorkflowStepStatus } from "@demo/components/shared/workflow-stepper"

export const APPROVAL_ROLES = [
  "End User",
  "Engineering Manager",
  "Commercial Manager",
  "Warehouse Supervisor",
] as const

export type ApprovalRole = (typeof APPROVAL_ROLES)[number]

/**
 * The parallel 4-step chain an OAR material runs through instead of the
 * standard one above: converting an OAR line to a standing Min-Max reorder
 * point is a stocking-policy decision, so it starts with Inventory Control
 * and ends at the Plant Head rather than starting with the End User.
 *
 * These are OAR-specific approval roles, not `SharedRole`s — the shared list
 * backs the role switcher and a Record<SharedRole, ...> weight map, and
 * widening it for four I07-only titles would ripple well past this module.
 * Mock titles only; the real SAP role mapping is still to be confirmed.
 */
export const OAR_APPROVAL_ROLES = [
  "Inventory Controller",
  "Commercial Head",
  "Engineering Head",
  "Plant Head",
] as const

export type OarApprovalRole = (typeof OAR_APPROVAL_ROLES)[number]

/**
 * The chain that applies to one recommendation. OAR materials carry
 * `oarConversion`; everything else runs the standard chain.
 */
export function rolesForRecommendation(isOar: boolean): readonly string[] {
  return isOar ? OAR_APPROVAL_ROLES : APPROVAL_ROLES
}

export const APPROVAL_STEP_IDS = [
  "end-user",
  "engineering-manager",
  "commercial-manager",
  "warehouse-supervisor",
] as const

export type ApprovalStepId = (typeof APPROVAL_STEP_IDS)[number]

export function approverName(role: ApprovalRole): string {
  return USERS.find((u) => u.role === role)?.name ?? role
}

/**
 * Name for any chain role, standard or OAR. The OAR titles have no named
 * person in the shared USERS list, so this returns null rather than echoing
 * the role back as if it were someone's name.
 */
export function chainApproverName(role: string): string | null {
  return USERS.find((u) => u.role === role)?.name ?? null
}

export function approvalStepLabel(role: ApprovalRole): string {
  return `${role} — ${approverName(role)}`
}

/** Builds one WorkflowStep for the approval stepper. */
export function approvalStep(
  index: number,
  status: WorkflowStepStatus,
  meta?: string,
  tone?: "default" | "warning" | "danger"
): WorkflowStep {
  const role = APPROVAL_ROLES[index]
  return {
    id: APPROVAL_STEP_IDS[index],
    label: approvalStepLabel(role),
    status,
    meta,
    tone,
  }
}

/** Convenience: build all 4 steps from a compact status list. */
export function buildWorkflow(
  steps: [WorkflowStepStatus, string?, ("default" | "warning" | "danger")?][]
): WorkflowStep[] {
  return steps.map(([status, meta, tone], index) => approvalStep(index, status, meta, tone))
}
