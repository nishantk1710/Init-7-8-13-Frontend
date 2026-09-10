import type { GlobalAction } from "@/lib/domain/contracts"
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"

/**
 * Every open Initiative 8 item for the global Action Center: flagged
 * duplicate-procurement declarations, mandatory declarations still
 * outstanding, and overdue repair chains.
 */
export function getInitiative8GlobalActions(): GlobalAction[] {
  const actions: GlobalAction[] = []

  for (const d of DECLARATIONS) {
    if (d.status === "Flagged") {
      actions.push({
        id: `i8-decl-flagged-${d.id}`,
        initiative: "initiative-8",
        title: `Duplicate procurement flagged — ${d.material.materialId} (${d.pr.documentNumber})`,
        severity: "critical",
        entityId: d.id,
        materialId: d.material.materialId,
        href: "/repairable-spares/declarations",
        createdAt: d.createdAt,
      })
    } else if (d.status === "Required") {
      actions.push({
        id: `i8-decl-required-${d.id}`,
        initiative: "initiative-8",
        title: `Condition-to-repair declaration required — ${d.material.materialId} (${d.pr.documentNumber})`,
        severity: "warning",
        entityId: d.id,
        materialId: d.material.materialId,
        href: "/repairable-spares/declarations",
        createdAt: d.createdAt,
      })
    }
  }

  for (const c of REPAIR_CHAINS) {
    if (c.repairStatus !== "Closed" && c.daysRemainingInRepair < 0) {
      actions.push({
        id: `i8-overdue-${c.id}`,
        initiative: "initiative-8",
        title: `Repair overdue — ${c.material.materialId} at ${c.vendor} (${Math.abs(
          c.daysRemainingInRepair
        )} days past due)`,
        severity: "critical",
        entityId: c.id,
        materialId: c.material.materialId,
        plantId: c.plant.plantId,
        href: `/repairable-spares/repair-register/${c.id}`,
        createdAt: c.raisedAt,
      })
    }
  }

  return actions
}
