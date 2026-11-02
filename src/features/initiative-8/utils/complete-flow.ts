import type { RepairChain } from "@/features/initiative-8/types/repair"

/**
 * What the Repairable Spares screens hide while the I08 complete flow is
 * switched off (`lib/i08-features`, 29-Oct-2026).
 *
 * With the switch off the backend already stops sending most of the new data
 * -- PR rows, the stock split, the new exception types -- and the screens
 * degrade the way they do against an older backend. These are the pieces the
 * data alone does not hide, written so they also hold when the backend is
 * older still or sends more than it should.
 */

/** The exception checks that were raised before the complete flow. */
export const CHECKS_BEFORE_COMPLETE_FLOW: readonly string[] = ["MISSING_ATTESTATION", "OVERDUE_REPAIR"]

/**
 * The exception types that get a tab, a count or an explanation.
 *
 * Off, only the checks raised before the complete flow -- plus any type that
 * does hold items, so nothing raised is ever unreachable, and the selected
 * one, so a stale link still names its tab.
 */
export function exceptionTypesShown(
  types: readonly string[],
  completeFlow: boolean,
  { counts, selected }: { counts?: Record<string, number>; selected?: string } = {},
): string[] {
  if (completeFlow) return [...types]
  return types.filter(
    (type) => CHECKS_BEFORE_COMPLETE_FLOW.includes(type) || (counts?.[type] ?? 0) > 0 || type === selected,
  )
}

/**
 * A repair line as the repair page shows it with the complete flow off: the
 * stock total rather than usable and damaged, no assistant session behind its
 * declaration, and no "linked through the R-reference" (a link the backend
 * makes only with the flow on). Everything else is left as it came.
 */
export function withoutCompleteFlow(chain: RepairChain): RepairChain {
  return {
    ...chain,
    usableStock: undefined,
    damagedStock: undefined,
    stockConditionKnown: undefined,
    declarationSessionId: undefined,
    declarationLink: chain.declarationLink === "REFERENCE" ? undefined : chain.declarationLink,
  }
}
