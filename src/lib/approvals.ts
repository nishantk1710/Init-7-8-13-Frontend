// Shared "needs a decision" view over the same cross-module action feed
// `lib/aggregation.ts` already computes — Approvals is a filtered
// presentation of Action Center's items, not a second data model. Both the
// `/approvals` page and Home's "Pending Approvals" tile read from here so
// they never drift apart.

import type { GlobalAction } from "@/lib/domain/contracts"
import { getAllGlobalActions } from "@/lib/aggregation"

/**
 * True for actions that need someone to make a specific decision (approve/
 * return a recommendation, declare a repair condition, confirm/re-plan/
 * release an OAR line, accept/dismiss a reclassification) — false for
 * actions that are informational reminders (e.g. "repair overdue" without
 * a pending declaration). Approximate mock classification by action title,
 * not a separate authored field — good enough for a demo, not a rule engine.
 */
function isDecisionAction(action: GlobalAction): boolean {
  if (action.initiative === "initiative-7") return true // every I7 action is an open recommendation
  if (action.initiative === "initiative-8") return action.title.includes("declaration") || action.title.includes("Duplicate procurement")
  if (action.initiative === "initiative-13") {
    return action.title.includes("Consumption confirmation") || action.title.includes("Reclassification candidate")
  }
  return false
}

export function getPendingApprovals(): GlobalAction[] {
  return getAllGlobalActions().filter(isDecisionAction)
}
