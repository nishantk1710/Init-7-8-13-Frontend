import type { AuditEvent } from "@/lib/domain/contracts"
import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"
import { ESCALATION_TIMELINES } from "@/features/initiative-13/data/escalations"
import { RECLASSIFICATION_CANDIDATES } from "@/features/initiative-13/data/reclassification"

/**
 * Every Initiative 13 audit-worthy event for the global Audit Trail —
 * derived from the ledger's document chain (consumption confirmed,
 * re-planned, redeployed) plus the escalation timelines and the
 * reclassification candidate set. Static/seeded, matching how the rest of
 * this mockup module works: UI actions on the Aging Exceptions / Redeployment
 * pages simulate a write via toast + local state, they don't mutate this feed.
 */
export function getInitiative13AuditEvents(): AuditEvent[] {
  const events: AuditEvent[] = []

  for (const line of LEDGER_LINES) {
    for (const step of line.documentChain) {
      if (step.stage === "Utilization Confirmed") {
        events.push({
          id: `oar-audit-${line.id}-confirmed`,
          initiative: "initiative-13",
          entityId: line.trackingId,
          eventType: "Consumption Confirmed",
          description: `${line.material.description} — ${step.description}`,
          actor: line.requester.name,
          timestamp: step.timestamp,
        })
      }
      if (step.stage === "Re-planned") {
        events.push({
          id: `oar-audit-${line.id}-replanned`,
          initiative: "initiative-13",
          entityId: line.trackingId,
          eventType: "Re-planned",
          description: `${line.material.description} — ${step.description}`,
          actor: line.requester.name,
          timestamp: step.timestamp,
        })
      }
      if (step.stage === "No Longer Required") {
        events.push({
          id: `oar-audit-${line.id}-redeployed`,
          initiative: "initiative-13",
          entityId: line.trackingId,
          eventType: "Marked for Redeployment",
          description: `${line.material.description} — ${step.description}`,
          actor: line.requester.name,
          timestamp: step.timestamp,
        })
      }
    }
  }

  for (const [lineId, timeline] of Object.entries(ESCALATION_TIMELINES)) {
    const line = LEDGER_LINES.find((l) => l.id === lineId)
    for (const step of timeline) {
      if (!step.label.startsWith("Escalated")) continue
      events.push({
        id: `oar-audit-${lineId}-${step.id}`,
        initiative: "initiative-13",
        entityId: line?.trackingId ?? lineId,
        eventType: "Escalated",
        description: `${line?.material.description ?? lineId} — ${step.label}`,
        timestamp: step.timestamp,
      })
    }
  }

  for (const candidate of RECLASSIFICATION_CANDIDATES) {
    if (!candidate.recommendation.startsWith("Candidate")) continue
    events.push({
      id: `oar-audit-${candidate.id}-reclassified`,
      initiative: "initiative-13",
      entityId: candidate.material.materialId,
      eventType: "Reclassification Flagged",
      description: `${candidate.material.description} — ${candidate.recommendation}`,
      timestamp: "3 Sep 2026",
    })
  }

  return events
}
