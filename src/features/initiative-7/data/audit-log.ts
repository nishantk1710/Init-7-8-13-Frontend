// Builds AuditEvent[] from each recommendation's workflow state — one place
// so both the global Audit Trail selector and the per-recommendation
// Timeline on the detail page read the same derivation.

import type { AuditEvent } from "@/lib/domain/contracts"
import { formatDateDMY } from "@/lib/utils"
import { APPROVAL_ROLES, approverName } from "@/features/initiative-7/data/approval-chain"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

// Fixed "today" for this mockup so "Xd ago" meta strings resolve to stable
// calendar dates instead of drifting with the real clock.
const TODAY = new Date(Date.UTC(2026, 8, 3))
const STEP_TIMES = ["09:10 AM", "11:35 AM", "02:20 PM", "04:05 PM"]

function dateFromDaysAgo(days: number): string {
  const d = new Date(TODAY)
  d.setUTCDate(d.getUTCDate() - days)
  return formatDateDMY(d)
}

function extractDaysAgo(meta?: string): number | null {
  if (!meta) return null
  const match = meta.match(/(\d+)d ago/)
  return match ? Number(match[1]) : null
}

/**
 * Absolute "DD Mon YYYY · HH:MM AM" for one approval step, resolved from its
 * authored "Xd ago" meta. Shared with the decision history so both readouts
 * time the same step identically.
 */
export function workflowStepTimestamp(rec: Recommendation, index: number): string {
  const daysAgo = extractDaysAgo(rec.workflow[index]?.meta)
  if (daysAgo === null) return rec.generatedAt
  return `${dateFromDaysAgo(daysAgo)} · ${STEP_TIMES[index] ?? STEP_TIMES[0]}`
}

export function buildAuditTrailForRecommendation(rec: Recommendation): AuditEvent[] {
  const events: AuditEvent[] = []

  events.push({
    id: `${rec.id}-generated`,
    initiative: "initiative-7",
    entityId: rec.id,
    eventType: "Recommendation generated",
    description: `ROP / safety-stock / max-stock recommendation generated for ${rec.material.description} (${rec.material.materialId}) at ${rec.plantId}.`,
    actor: "System",
    timestamp: rec.generatedAt,
  })

  rec.workflow.forEach((step, index) => {
    if (step.status === "pending" || step.status === "skipped") return
    if (step.status === "active" && !step.meta) return

    const role = APPROVAL_ROLES[index]
    const daysAgo = extractDaysAgo(step.meta)
    const timestamp = daysAgo !== null ? `${dateFromDaysAgo(daysAgo)} · ${STEP_TIMES[index]}` : rec.generatedAt

    let eventType = `${role} — updated`
    if (step.status === "done") eventType = `${role} approved`
    else if (step.status === "rejected") eventType = `${role} rejected`
    else if (step.status === "returned") eventType = `${role} returned for clarification`
    else if (step.status === "active" && step.tone === "danger") eventType = `${role} — escalated`
    else if (step.status === "active") eventType = `${role} — notice`

    events.push({
      id: `${rec.id}-step-${index}`,
      initiative: "initiative-7",
      entityId: rec.id,
      eventType,
      description: `${step.meta ?? eventType} — ${rec.material.description} (${rec.material.materialId}).`,
      actor: approverName(role),
      timestamp,
    })
  })

  if (rec.status === "Implemented") {
    events.push({
      id: `${rec.id}-sap-simulated`,
      initiative: "initiative-7",
      entityId: rec.id,
      eventType: "SAP update simulated",
      description: `Simulated SAP MRP-view update for ${rec.material.description} — ROP ${rec.recommended.rop}, Safety Stock ${rec.recommended.safetyStock}, Max Stock ${rec.recommended.maxStock}. No live SAP write occurred.`,
      actor: "System",
      timestamp: rec.generatedAt,
    })
  }

  return events
}

export function getAllInitiative7AuditEvents(): AuditEvent[] {
  return RECOMMENDATIONS.flatMap(buildAuditTrailForRecommendation)
}
