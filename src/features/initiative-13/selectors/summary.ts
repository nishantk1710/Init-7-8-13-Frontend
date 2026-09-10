import type { InitiativeSummary } from "@/lib/domain/contracts"
import { initiative13Manifest } from "@/features/initiative-13/manifest"
import { getOverviewKpis } from "@/features/initiative-13/data/overview-metrics"
import { getInitiative13GlobalActions } from "@/features/initiative-13/selectors/global-actions"
import { formatCount, formatZARCompact } from "@/lib/utils"

/**
 * Feeds Home and the global Action Center.
 */
export function getInitiative13Summary(): InitiativeSummary {
  const kpis = getOverviewKpis()
  const actions = getInitiative13GlobalActions()
  const hasCritical = actions.some((a) => a.severity === "critical")

  return {
    id: "initiative-13",
    label: initiative13Manifest.name,
    href: initiative13Manifest.href,
    health: hasCritical ? "critical" : kpis.agedLines > 0 ? "attention" : "healthy",
    metrics: [
      { label: "Unutilized OAR value", value: formatZARCompact(kpis.unutilizedValue) },
      { label: "Unutilized OAR qty", value: formatCount(kpis.unutilizedQty) },
      { label: "Plan compliance", value: `${kpis.complianceRate}%` },
      { label: "Aged OAR lines", value: kpis.agedLines },
    ],
    actions,
  }
}
