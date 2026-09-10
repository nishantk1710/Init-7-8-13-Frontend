import type { InitiativeHealth, InitiativeSummary } from "@/lib/domain/contracts"
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { getInitiative8GlobalActions } from "@/features/initiative-8/selectors/global-actions"

/**
 * Real numbers derived from `features/initiative-8/data/*`. Feeds the Spares
 * Control Tower Overview page and the global Action Center.
 */
export function getInitiative8Summary(): InitiativeSummary {
  const activeChains = REPAIR_CHAINS.filter((c) => c.repairStatus !== "Closed")
  const qtyUnderRepair = REPAIR_CHAINS.reduce((sum, c) => sum + c.qtyUnderRepair, 0)
  const flaggedCount = DECLARATIONS.filter((d) => d.status === "Flagged").length
  const overdueCount = activeChains.filter((c) => c.daysRemainingInRepair < 0).length
  const pendingDeclarations = DECLARATIONS.filter(
    (d) => d.status === "Required" || d.status === "Pending"
  ).length

  const health: InitiativeHealth =
    flaggedCount > 0 ? "critical" : overdueCount > 0 || pendingDeclarations > 2 ? "attention" : "healthy"

  return {
    id: "initiative-8",
    label: initiative8Manifest.name,
    href: initiative8Manifest.href,
    health,
    metrics: [
      { label: "Active repair chains", value: activeChains.length },
      { label: "Qty under repair", value: qtyUnderRepair },
      { label: "Pending declarations", value: pendingDeclarations },
      { label: "Duplicate alerts", value: flaggedCount },
    ],
    actions: getInitiative8GlobalActions(),
  }
}
