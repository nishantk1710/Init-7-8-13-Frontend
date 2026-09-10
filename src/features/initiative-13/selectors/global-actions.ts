import type { GlobalAction } from "@/lib/domain/contracts"
import { LEDGER_LINES } from "@/features/initiative-13/data/ledger"
import { RECLASSIFICATION_CANDIDATES } from "@/features/initiative-13/data/reclassification"

/**
 * Every open Initiative 13 action for the global Action Center — derived
 * from the ledger's exception lines plus the redeployment/reclassification
 * seed data, so this stays in sync with what the Aging Exceptions,
 * Redeployment and Reclassification pages actually show.
 */
export function getInitiative13GlobalActions(): GlobalAction[] {
  const actions: GlobalAction[] = []

  for (const line of LEDGER_LINES) {
    if (line.exception === "Consumption Overdue") {
      const escalated = line.documentChain.some((step) => step.tone === "danger")
      actions.push({
        id: `oar-action-${line.id}`,
        initiative: "initiative-13",
        title: `Consumption confirmation overdue — ${line.material.description} (${line.agingDays}d)`,
        severity: escalated ? "critical" : "warning",
        entityId: line.id,
        materialId: line.material.materialId,
        plantId: line.plant.plantId,
        href: "/oar-utilization/aging-exceptions",
        createdAt: line.plannedConsumptionDate,
      })
    }
    if (line.exception === "No Longer Required") {
      actions.push({
        id: `oar-action-${line.id}-redeploy`,
        initiative: "initiative-13",
        title: `Redeployment opportunity — ${line.material.description} available at ${line.plant.name}`,
        severity: "info",
        entityId: line.id,
        materialId: line.material.materialId,
        plantId: line.plant.plantId,
        href: "/oar-utilization/redeployment",
        createdAt: line.plannedConsumptionDate,
      })
    }
  }

  const topReclassification = RECLASSIFICATION_CANDIDATES.find((c) =>
    c.recommendation.startsWith("Candidate")
  )
  if (topReclassification) {
    actions.push({
      id: `oar-action-${topReclassification.id}`,
      initiative: "initiative-13",
      title: `Reclassification candidate ready for review — ${topReclassification.material.description}`,
      severity: "info",
      materialId: topReclassification.material.materialId,
      href: "/oar-utilization/reclassification",
      createdAt: "3 Sep 2026",
    })
  }

  return actions
}
