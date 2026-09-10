// Global aggregation of per-initiative summaries/actions/audit events. This
// is the ONLY place that imports every initiative's `selectors/summary.ts`,
// `selectors/global-actions.ts` and `selectors/audit-events.ts` together —
// used by Home, the Action Center, and the
// Audit Trail. No business logic here, only composition.

import { getInitiative7Summary } from "@/features/initiative-7/selectors/summary"
import { getInitiative7GlobalActions } from "@/features/initiative-7/selectors/global-actions"
import { getInitiative7AuditEvents } from "@/features/initiative-7/selectors/audit-events"
import { getInitiative8Summary } from "@/features/initiative-8/selectors/summary"
import { getInitiative8GlobalActions } from "@/features/initiative-8/selectors/global-actions"
import { getInitiative8AuditEvents } from "@/features/initiative-8/selectors/audit-events"
import { getInitiative13Summary } from "@/features/initiative-13/selectors/summary"
import { getInitiative13GlobalActions } from "@/features/initiative-13/selectors/global-actions"
import { getInitiative13AuditEvents } from "@/features/initiative-13/selectors/audit-events"
import type { AuditEvent, GlobalAction, InitiativeSummary } from "@/lib/domain/contracts"

export function getAllInitiativeSummaries(): InitiativeSummary[] {
  return [getInitiative7Summary(), getInitiative8Summary(), getInitiative13Summary()]
}

export function getAllGlobalActions(): GlobalAction[] {
  return [
    ...getInitiative7GlobalActions(),
    ...getInitiative8GlobalActions(),
    ...getInitiative13GlobalActions(),
  ]
}

export function getAllAuditEvents(): AuditEvent[] {
  return [
    ...getInitiative7AuditEvents(),
    ...getInitiative8AuditEvents(),
    ...getInitiative13AuditEvents(),
  ]
}
