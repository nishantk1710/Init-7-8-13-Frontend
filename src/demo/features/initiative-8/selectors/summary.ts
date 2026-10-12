import type { InitiativeHealth, InitiativeSummary } from "@demo/lib/domain/contracts"
import { initiative8Manifest } from "@demo/features/initiative-8/manifest"
import { summarise } from "@demo/features/initiative-8/model/metrics"
import { BASE_SNAPSHOT } from "@demo/features/initiative-8/model/snapshot"
import { getInitiative8GlobalActions } from "@demo/features/initiative-8/selectors/global-actions"

/**
 * Real numbers derived from the Initiative 8 snapshot — the same figures its
 * Overview shows. Feeds the Spares Control Tower Overview page and the global
 * Action Center.
 */
export function getInitiative8Summary(): InitiativeSummary {
  const metrics = summarise(BASE_SNAPSHOT)
  const flagged = BASE_SNAPSHOT.lines.filter((l) => l.declarationStatus === "Flagged").length
  // Items raised before Spares Automation existed are left out: nobody could
  // have recorded anything against them, so counting them here would put work
  // on the Home card that no one can do.
  const actionableExceptions = BASE_SNAPSHOT.exceptions.filter(
    (e) => !e.preAutomation && (e.status === "OPEN" || e.status === "IN_PROGRESS"),
  ).length

  const health: InitiativeHealth =
    flagged > 0 || metrics.openByType.UNJUSTIFIED_ACQUISITION > 0
      ? "critical"
      : metrics.overdueLines > 0 || metrics.pendingDeclarations > 2
        ? "attention"
        : "healthy"

  return {
    id: "initiative-8",
    label: initiative8Manifest.name,
    href: initiative8Manifest.href,
    health,
    metrics: [
      { label: "Active repair lines", value: metrics.openLines },
      { label: "Qty under repair", value: metrics.qtyUnderRepair },
      { label: "Pending declarations", value: metrics.pendingDeclarations },
      { label: "Open exceptions", value: actionableExceptions },
    ],
    actions: getInitiative8GlobalActions(),
  }
}
