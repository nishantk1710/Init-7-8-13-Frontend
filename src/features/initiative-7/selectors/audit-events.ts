import type { AuditEvent } from "@/lib/domain/contracts"
import { getAllInitiative7AuditEvents } from "@/features/initiative-7/data/audit-log"

/**
 * Every Initiative 7 audit event (recommendation generated, approval step
 * taken, SAP update simulated) for the global Audit Trail page.
 */
export function getInitiative7AuditEvents(): AuditEvent[] {
  return getAllInitiative7AuditEvents()
}
