// Fixed 4-step approval chain shared by every recommendation: End User ->
// Engineering Manager -> Commercial Manager -> Warehouse Supervisor. Approver
// names are pulled from the shared USERS list (never invented locally) so
// the chain reads consistently with the rest of the app.

import { USERS } from "@/lib/shared-data/users"
import type { WorkflowStep, WorkflowStepStatus } from "@/components/shared/workflow-stepper"

export const APPROVAL_ROLES = [
  "End User",
  "Engineering Manager",
  "Commercial Manager",
  "Warehouse Supervisor",
] as const

export type ApprovalRole = (typeof APPROVAL_ROLES)[number]

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
