// Role-aware re-ranking (§6) of the same cross-module action feed
// `lib/aggregation.ts` already computes — no separate data per role, just a
// different sort order over one list.

import type { ActionSeverity, GlobalAction, InitiativeId } from "@/lib/domain/contracts"
import type { SharedRole } from "@/lib/shared-data/users"

const SEVERITY_SCORE: Record<ActionSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

/** How much each role naturally weights each module's items, relative to 1. */
const ROLE_INITIATIVE_WEIGHT: Record<SharedRole, Record<InitiativeId, number>> = {
  "End User": { "initiative-13": 1.4, "initiative-8": 1.2, "initiative-7": 1 },
  Requester: { "initiative-13": 1.4, "initiative-8": 1, "initiative-7": 1 },
  "Engineering Manager": { "initiative-7": 1.3, "initiative-8": 1.2, "initiative-13": 1 },
  "Commercial Manager": { "initiative-7": 1.4, "initiative-8": 1.3, "initiative-13": 1 },
  "Warehouse Supervisor": { "initiative-8": 1.3, "initiative-13": 1.2, "initiative-7": 1 },
  HOD: { "initiative-13": 1.3, "initiative-7": 1.3, "initiative-8": 1 },
  "Inventory Control": { "initiative-7": 1.3, "initiative-13": 1.3, "initiative-8": 1.1 },
}

export function sortActionsForRole(actions: GlobalAction[], role: SharedRole): GlobalAction[] {
  const weights = ROLE_INITIATIVE_WEIGHT[role]
  return [...actions].sort(
    (a, b) =>
      SEVERITY_SCORE[b.severity] * weights[b.initiative] -
      SEVERITY_SCORE[a.severity] * weights[a.initiative]
  )
}
