import type { AuditEvent } from "@/lib/domain/contracts"
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"

/**
 * Every Initiative 8 audit-worthy event for the global Audit Trail: repair
 * PR/PO lifecycle steps, duplicate-procurement warnings shown, and completed
 * condition-to-repair declarations. All "Simulated" — no live SAP writes.
 */
export function getInitiative8AuditEvents(): AuditEvent[] {
  const events: AuditEvent[] = []

  for (const c of REPAIR_CHAINS) {
    events.push({
      id: `i8-audit-${c.id}-pr`,
      initiative: "initiative-8",
      entityId: c.id,
      eventType: "Repair PR Raised",
      description: `${c.repairPR.documentNumber} raised for ${c.material.materialId} (${c.material.description}) — Simulated.`,
      timestamp: c.raisedAt,
    })

    if (c.repairPO && c.poIssuedAt) {
      events.push({
        id: `i8-audit-${c.id}-po`,
        initiative: "initiative-8",
        entityId: c.id,
        eventType: "Repair PO Issued",
        description: `${c.repairPO.documentNumber} issued to ${c.vendor} for ${c.material.materialId} — Simulated.`,
        timestamp: c.poIssuedAt,
      })
    }

    if (c.sentToVendorAt) {
      events.push({
        id: `i8-audit-${c.id}-sent`,
        initiative: "initiative-8",
        entityId: c.id,
        eventType: "Sent To Vendor",
        description: `Unit for ${c.material.materialId} dispatched to ${c.vendor} — Simulated goods issue.`,
        timestamp: c.sentToVendorAt,
      })
    }

    if (c.receivedAt) {
      events.push({
        id: `i8-audit-${c.id}-received`,
        initiative: "initiative-8",
        entityId: c.id,
        eventType: "Repair Receipted",
        description: `Repaired unit for ${c.material.materialId} receipted back into stores — Simulated goods receipt.`,
        timestamp: c.receivedAt,
      })
    }

    if (c.declarationStatus === "Flagged") {
      events.push({
        id: `i8-audit-${c.id}-duplicate`,
        initiative: "initiative-8",
        entityId: c.id,
        eventType: "Duplicate Warning Shown",
        description: `Duplicate Guard flagged a new-unit request against ${c.material.materialId} while ${
          c.repairPO?.documentNumber ?? "its repair PO"
        } was open.`,
        timestamp: c.poIssuedAt ?? c.raisedAt,
      })
    }
  }

  for (const d of DECLARATIONS) {
    if (d.status === "Completed" && d.declaredAt) {
      events.push({
        id: `i8-audit-decl-${d.id}`,
        initiative: "initiative-8",
        entityId: d.id,
        eventType: "Declaration Completed",
        description: `${d.material.materialId} declared "${d.condition}" by ${d.declaredBy ?? "—"} for ${d.pr.documentNumber} — Simulated, not written to SAP.`,
        actor: d.declaredBy,
        timestamp: d.declaredAt,
      })
    }
  }

  return events
}
