import type { AuditEvent } from "@demo/lib/domain/contracts"
import { BASE_SNAPSHOT } from "@demo/features/initiative-8/model/snapshot"
import { STAGE_LABEL, exceptionTypeLabel } from "@demo/features/initiative-8/utils/status"

/**
 * Every Initiative 8 audit-worthy event for the global Audit Trail: each
 * repair line's lifecycle steps, every declaration and amendment, every
 * justification, and every change to an exception. All "Simulated" — no SAP
 * writes.
 */
export function getInitiative8AuditEvents(): AuditEvent[] {
  const events: AuditEvent[] = []

  for (const line of BASE_SNAPSHOT.lines) {
    for (const step of line.stages) {
      if (step.stage === "ATTESTED") continue
      events.push({
        id: `i8-audit-${line.id}-${step.stage}`,
        initiative: "initiative-8",
        entityId: line.id,
        eventType: STAGE_LABEL[step.stage],
        description: `${line.id}: ${line.material.materialId} (${line.material.description}) — ${STAGE_LABEL[step.stage].toLowerCase()}${step.stage === "AT_VENDOR" ? ` at ${line.vendor}` : ""}.`,
        timestamp: step.at,
      })
    }
  }

  for (const d of BASE_SNAPSHOT.declarations) {
    events.push({
      id: `i8-audit-${d.id}`,
      initiative: "initiative-8",
      entityId: d.id,
      eventType: d.supersedes ? "Declaration Amended" : "Declaration Recorded",
      description: `${d.material.materialId} declared "${d.condition}" by ${d.declaredBy}${d.supersedes ? `, replacing ${d.supersedes}: ${d.amendmentReason ?? ""}` : ""} — not posted to SAP.`,
      actor: d.declaredBy,
      timestamp: d.declaredAt,
    })
  }

  for (const j of BASE_SNAPSHOT.justifications) {
    events.push({
      id: `i8-audit-${j.id}`,
      initiative: "initiative-8",
      entityId: j.id,
      eventType: "Justification Recorded",
      description: `${j.author} recorded why a new ${j.material.materialId} was bought (${j.reasonCategory.replace(/_/g, " ").toLowerCase()}).`,
      actor: j.author,
      timestamp: j.recordedAt,
    })
  }

  for (const e of BASE_SNAPSHOT.exceptions) {
    e.history.forEach((event, index) => {
      events.push({
        id: `i8-audit-${e.id}-${index}`,
        initiative: "initiative-8",
        entityId: e.id,
        eventType: `${exceptionTypeLabel(e.type)} — ${event.kind === "RAISED" ? "Raised" : event.kind === "AUTO_RESOLVED" ? "Resolved" : event.kind === "ASSIGNED" ? "Assigned" : event.kind === "COMMENT" ? "Comment" : "Status"}`,
        description: `${e.id} (${e.material.materialId}): ${event.text}`,
        actor: event.actor,
        timestamp: event.at,
      })
    })
  }

  return events
}
