"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { AuditEvent } from "@/lib/domain/contracts"
import type { WorkflowStep } from "@/components/shared/workflow-stepper"
import { APPROVAL_ROLES, approverName } from "@/features/initiative-7/data/approval-chain"
import { buildAuditTrailForRecommendation } from "@/features/initiative-7/data/audit-log"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

export type SapUpdateStatus =
  | "Awaiting Final Approval"
  | "Approved — Ready for SAP Update"
  | "SAP Update Simulated"
  | "Rejected — No SAP Update"

let auditEventSeq = 0

function nowLabel() {
  return "Just now"
}

/**
 * Client-side, in-memory approval workflow state for one recommendation's
 * detail page. Every action (Approve/Reject/Return/Escalate/Simulate SAP
 * Update) mutates local state only — nothing is written to SAP or persisted
 * across reloads, matching the "simulated" rule for this mockup.
 */
export function useRecommendationWorkflow(recommendation: Recommendation) {
  const [workflow, setWorkflow] = useState<WorkflowStep[]>(() =>
    recommendation.workflow.map((s) => ({ ...s }))
  )
  const [sapSimulated, setSapSimulated] = useState(recommendation.status === "Implemented")
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>(() =>
    buildAuditTrailForRecommendation(recommendation)
  )

  const activeIndex = workflow.findIndex((s) => s.status === "active")
  const hasRejected = workflow.some((s) => s.status === "rejected")
  const hasReturned = workflow.some((s) => s.status === "returned")
  const allDone = workflow.every((s) => s.status === "done")

  const sapStatus: SapUpdateStatus = hasRejected
    ? "Rejected — No SAP Update"
    : allDone && sapSimulated
      ? "SAP Update Simulated"
      : allDone
        ? "Approved — Ready for SAP Update"
        : "Awaiting Final Approval"

  function appendAudit(eventType: string, description: string, actor: string) {
    auditEventSeq += 1
    setAuditTrail((prev) => [
      ...prev,
      {
        id: `${recommendation.id}-live-${auditEventSeq}`,
        initiative: "initiative-7",
        entityId: recommendation.id,
        eventType,
        description,
        actor,
        timestamp: nowLabel(),
      },
    ])
  }

  function approve() {
    if (activeIndex === -1) return
    const role = APPROVAL_ROLES[activeIndex]
    const actor = approverName(role)
    setWorkflow((prev) =>
      prev.map((step, i) => {
        if (i === activeIndex) return { ...step, status: "done", meta: "Approved just now", tone: "default" }
        if (i === activeIndex + 1) return { ...step, status: "active", meta: undefined, tone: "default" }
        return step
      })
    )
    appendAudit(
      `${role} approved`,
      `Approved by ${actor} — ${recommendation.material.description} (${recommendation.material.materialId}).`,
      actor
    )
    toast.success(`${role} approved — ${recommendation.material.description}`)
  }

  function reject(reason?: string) {
    if (activeIndex === -1) return
    const role = APPROVAL_ROLES[activeIndex]
    const actor = approverName(role)
    const meta = reason ?? "Rejected — insufficient justification"
    setWorkflow((prev) =>
      prev.map((step, i) => {
        if (i === activeIndex) return { ...step, status: "rejected", meta, tone: "danger" }
        if (i > activeIndex) return { ...step, status: "skipped", meta: undefined, tone: "default" }
        return step
      })
    )
    appendAudit(
      `${role} rejected`,
      `${meta} — ${recommendation.material.description} (${recommendation.material.materialId}).`,
      actor
    )
    toast.error(`${role} rejected — ${recommendation.material.description}`)
  }

  function returnStep(reason?: string) {
    if (activeIndex === -1) return
    const role = APPROVAL_ROLES[activeIndex]
    const actor = approverName(role)
    const meta = reason ?? `Returned to ${APPROVAL_ROLES[0]} for clarification`
    setWorkflow((prev) =>
      prev.map((step, i) => {
        if (i === activeIndex) return { ...step, status: "returned", meta, tone: "warning" }
        if (i === 0) return { ...step, status: "active", meta: "Re-submission requested", tone: "default" }
        if (i > 0 && i < activeIndex) return { ...step, status: "pending", meta: undefined, tone: "default" }
        return step
      })
    )
    appendAudit(
      `${role} returned`,
      `${meta} — ${recommendation.material.description} (${recommendation.material.materialId}).`,
      actor
    )
    toast.warning(`${role} returned — ${recommendation.material.description}`)
  }

  function escalate(reason?: string) {
    if (activeIndex === -1) return
    const role = APPROVAL_ROLES[activeIndex]
    const actor = approverName(role)
    const meta = reason ?? "Escalated — awaiting HOD attention"
    setWorkflow((prev) =>
      prev.map((step, i) => (i === activeIndex ? { ...step, meta, tone: "danger" } : step))
    )
    appendAudit(
      `${role} escalated`,
      `${meta} — ${recommendation.material.description} (${recommendation.material.materialId}).`,
      actor
    )
    toast.warning(`Escalated — ${recommendation.material.description}`)
  }

  function simulateSapUpdate() {
    if (!allDone || sapSimulated) return
    setSapSimulated(true)
    appendAudit(
      "SAP update simulated",
      `Simulated SAP MRP-view update for ${recommendation.material.description} — ROP ${recommendation.recommended.rop}, Safety Stock ${recommendation.recommended.safetyStock}, Max Stock ${recommendation.recommended.maxStock}. No live SAP write occurred.`,
      "System"
    )
    toast.success("SAP update simulated — no live SAP write occurred")
  }

  const canAct = activeIndex !== -1

  return {
    workflow,
    auditTrail,
    sapStatus,
    canAct,
    hasReturned,
    approve,
    reject,
    returnStep,
    escalate,
    simulateSapUpdate,
  }
}
