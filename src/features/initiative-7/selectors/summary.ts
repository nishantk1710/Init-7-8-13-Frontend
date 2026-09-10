import type { GlobalAction, InitiativeSummary } from "@/lib/domain/contracts"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import {
  countAtStockoutRisk,
  countAwaitingApproval,
  countExcessCandidates,
  deriveOverallHealth,
  formatSignedZAR,
  netWorkingCapitalImpact,
} from "@/features/initiative-7/utils/inventory-calc"
import { getInitiative7GlobalActions } from "@/features/initiative-7/selectors/global-actions"

/**
 * Feeds Home's summary cards and the global Action
 * Center. Numbers are derived from the mock RECOMMENDATIONS dataset — see
 * `features/initiative-7/data/recommendations.ts`.
 */
export function getInitiative7Summary(): InitiativeSummary {
  const actions: GlobalAction[] = getInitiative7GlobalActions()

  return {
    id: "initiative-7",
    label: initiative7Manifest.name,
    href: initiative7Manifest.href,
    health: deriveOverallHealth(RECOMMENDATIONS),
    metrics: [
      { label: "Materials at stockout risk", value: countAtStockoutRisk(RECOMMENDATIONS) },
      { label: "Excess inventory candidates", value: countExcessCandidates(RECOMMENDATIONS) },
      { label: "Awaiting approval", value: countAwaitingApproval(RECOMMENDATIONS) },
      { label: "Net working-capital impact", value: formatSignedZAR(netWorkingCapitalImpact(RECOMMENDATIONS)) },
    ],
    actions,
  }
}
