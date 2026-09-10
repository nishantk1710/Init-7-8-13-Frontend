"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import type { AuditEvent } from "@/lib/domain/contracts"
import { USERS } from "@/lib/shared-data/users"
import { formatTime12h } from "@/lib/utils"
import { APPROVAL_ROLES, approverName, type ApprovalRole } from "@/features/initiative-7/data/approval-chain"
import { workflowStepTimestamp } from "@/features/initiative-7/data/audit-log"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { datasetDateLabel, REFERENCE_DATE_LABEL } from "@/features/initiative-7/utils/inventory-calc"

/** Live actions are stamped on the dataset's "today" with the real clock time. */
function liveTimestamp(): string {
  return `${REFERENCE_DATE_LABEL} · ${formatTime12h(new Date())}`
}

export const CHAIN_LENGTH = APPROVAL_ROLES.length

export type ApprovalOutcome = "approved" | "rejected" | "adjusted"

export interface DecisionEntry {
  actor: string
  /** e.g. "sent this for approval", "approved as End User" */
  action: string
  /** Absolute "DD Mon YYYY · HH:MM AM". */
  timestamp: string
  /** The comment the approver recorded with the decision, where there was one. */
  comment?: string
}

export interface WorkflowRecordState {
  /** false = still with the planner, not yet in the approval chain. */
  submitted: boolean
  /** Index into APPROVAL_ROLES of the role currently deciding; CHAIN_LENGTH once the chain is complete. */
  stepIndex: number
  outcome: ApprovalOutcome | null
  /** Dataset date label, e.g. "18 Aug 2026". */
  submittedOn: string | null
  requestedBy: string | null
  history: DecisionEntry[]
}

const REQUESTERS = USERS.filter((u) => u.role === "Requester")

/** Stable per-recommendation requester, so the demo reads consistently. */
function requesterFor(rec: Recommendation): string {
  const index = RECOMMENDATIONS.findIndex((r) => r.id === rec.id)
  return REQUESTERS[Math.max(0, index) % REQUESTERS.length]?.name ?? "Requester"
}

/**
 * Seeds live state from the authored workflow. "Pending Review" means the
 * planner has not sent it into the chain yet — that's the Not-submitted
 * bucket the Recommendations page acts on.
 */
export function seedState(rec: Recommendation): WorkflowRecordState {
  const submitted = rec.status !== "Pending Review"
  const activeIndex = rec.workflow.findIndex((s) => s.status === "active")
  const rejectedIndex = rec.workflow.findIndex((s) => s.status === "rejected")
  const doneCount = rec.workflow.filter((s) => s.status === "done").length

  const outcome: ApprovalOutcome | null =
    rejectedIndex !== -1
      ? "rejected"
      : rec.status === "Approved" || rec.status === "Implemented"
        ? "approved"
        : null

  const submittedOn = submitted ? datasetDateLabel(rec.generatedAt) : null
  const requestedBy = submitted ? requesterFor(rec) : null

  const history: DecisionEntry[] = []
  if (submitted && requestedBy) {
    history.push({
      actor: requestedBy,
      action: "sent this for approval",
      timestamp: rec.generatedAt,
    })
  }
  for (let i = 0; i < doneCount; i++) {
    const role = APPROVAL_ROLES[i]
    history.push({
      actor: approverName(role),
      action: `approved as ${role}`,
      timestamp: workflowStepTimestamp(rec, i),
    })
  }
  if (rejectedIndex !== -1) {
    const role = APPROVAL_ROLES[rejectedIndex]
    history.push({
      actor: approverName(role),
      action: `rejected as ${role}`,
      timestamp: workflowStepTimestamp(rec, rejectedIndex),
      comment: rec.workflow[rejectedIndex]?.meta,
    })
  }

  return {
    submitted,
    stepIndex: rejectedIndex !== -1 ? rejectedIndex : activeIndex === -1 ? CHAIN_LENGTH : activeIndex,
    outcome,
    submittedOn,
    requestedBy,
    history,
  }
}

function seedAll(): Record<string, WorkflowRecordState> {
  return Object.fromEntries(RECOMMENDATIONS.map((r) => [r.id, seedState(r)]))
}

const EVENT_TYPE: Record<string, string> = {
  "sent this for approval": "Sent for approval",
  approved: "Approved",
  adjusted: "Adjusted",
  rejected: "Rejected",
}

function eventTypeFor(action: string): string {
  const key = Object.keys(EVENT_TYPE).find((k) => action.startsWith(k) || action.includes(k))
  return key ? EVENT_TYPE[key] : "Decision recorded"
}

/**
 * Audit events for decisions taken THIS session, beyond the authored
 * baseline `seedState` already contributes to the static audit trail. Diffing
 * against the seed (rather than tracking a separate live-only log) means a
 * decision is recorded exactly once, however it was taken — Recommendations
 * page, Approvals workspace, or Action Center all share this one state.
 */
export function liveDecisionEvents(rec: Recommendation, state: WorkflowRecordState): AuditEvent[] {
  const baseline = seedState(rec).history.length
  return state.history.slice(baseline).map((entry, index) => ({
    id: `${rec.id}-live-${baseline + index}`,
    initiative: "initiative-7" as const,
    entityId: rec.id,
    eventType: eventTypeFor(entry.action),
    description:
      `${entry.actor} ${entry.action} — ${rec.material.description} (${rec.material.materialId}).` +
      (entry.comment ? ` "${entry.comment}"` : ""),
    actor: entry.actor,
    timestamp: entry.timestamp,
  }))
}

interface WorkflowContextValue {
  states: Record<string, WorkflowRecordState>
  stateFor: (recommendationId: string) => WorkflowRecordState
  pendingRole: (recommendationId: string) => ApprovalRole | null
  sendForApproval: (rec: Recommendation) => void
  approve: (rec: Recommendation, comment?: string) => void
  adjust: (rec: Recommendation, comment?: string) => void
  reject: (rec: Recommendation, comment?: string) => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

const FALLBACK: WorkflowRecordState = {
  submitted: false,
  stepIndex: 0,
  outcome: null,
  submittedOn: null,
  requestedBy: null,
  history: [],
}

/**
 * In-memory approval state shared by every Inventory Planning page, so a
 * "Send for approval" on the Recommendations page shows up in the Approval
 * Queue and the Pipeline. Nothing is persisted and no SAP write ever happens —
 * a refresh returns every recommendation to its authored state.
 */
export function InventoryWorkflowProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, WorkflowRecordState>>(seedAll)

  const patch = useCallback(
    (id: string, next: (prev: WorkflowRecordState) => WorkflowRecordState) => {
      setStates((prev) => ({ ...prev, [id]: next(prev[id] ?? FALLBACK) }))
    },
    []
  )

  const stateFor = useCallback(
    (id: string) => states[id] ?? FALLBACK,
    [states]
  )

  const pendingRole = useCallback(
    (id: string): ApprovalRole | null => {
      const state = states[id] ?? FALLBACK
      if (!state.submitted || state.outcome === "rejected" || state.stepIndex >= CHAIN_LENGTH) return null
      return APPROVAL_ROLES[state.stepIndex]
    },
    [states]
  )

  const sendForApproval = useCallback(
    (rec: Recommendation) => {
      const requester = requesterFor(rec)
      patch(rec.id, (prev) =>
        prev.submitted
          ? prev
          : {
              ...prev,
              submitted: true,
              stepIndex: 0,
              outcome: null,
              submittedOn: REFERENCE_DATE_LABEL,
              requestedBy: requester,
              history: [
                ...prev.history,
                { actor: requester, action: "sent this for approval", timestamp: liveTimestamp() },
              ],
            }
      )
      toast.success(`Sent for approval — ${rec.material.description}`, {
        description: `Now with ${APPROVAL_ROLES[0]} (${approverName(APPROVAL_ROLES[0])}) in the approval queue.`,
      })
    },
    [patch]
  )

  const decide = useCallback(
    (rec: Recommendation, outcome: ApprovalOutcome, comment?: string) => {
      const state = states[rec.id] ?? FALLBACK
      if (!state.submitted || state.stepIndex >= CHAIN_LENGTH || state.outcome === "rejected") return
      const role = APPROVAL_ROLES[state.stepIndex]
      const actor = approverName(role)
      const action =
        outcome === "approved"
          ? `approved as ${role}`
          : outcome === "adjusted"
            ? `adjusted the parameters as ${role}`
            : `rejected as ${role}`

      patch(rec.id, (prev) => {
        const advanced = outcome === "rejected" ? prev.stepIndex : prev.stepIndex + 1
        return {
          ...prev,
          stepIndex: advanced,
          outcome:
            outcome === "rejected"
              ? "rejected"
              : advanced >= CHAIN_LENGTH
                ? outcome === "adjusted"
                  ? "adjusted"
                  : "approved"
                : null,
          history: [
            ...prev.history,
            { actor, action, timestamp: liveTimestamp(), comment: comment?.trim() || undefined },
          ],
        }
      })

      const message = `${actor} — ${rec.material.description}`
      if (outcome === "rejected") toast.error(`Rejected as ${role}`, { description: message })
      else if (outcome === "adjusted") toast.warning(`Adjusted as ${role}`, { description: message })
      else toast.success(`Approved as ${role}`, { description: message })
    },
    [patch, states]
  )

  const value = useMemo<WorkflowContextValue>(
    () => ({
      states,
      stateFor,
      pendingRole,
      sendForApproval,
      approve: (rec, comment) => decide(rec, "approved", comment),
      adjust: (rec, comment) => decide(rec, "adjusted", comment),
      reject: (rec, comment) => decide(rec, "rejected", comment),
    }),
    [states, stateFor, pendingRole, sendForApproval, decide]
  )

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useInventoryWorkflow(): WorkflowContextValue {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error("useInventoryWorkflow must be used inside an InventoryWorkflowProvider")
  }
  return context
}
