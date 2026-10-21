import type { GlobalAction } from "@demo/lib/domain/contracts"
import { BASE_SNAPSHOT } from "@demo/features/initiative-8/model/snapshot"
import { exceptionTypeLabel } from "@demo/features/initiative-8/utils/status"

/**
 * Every open Initiative 8 item for the global Action Center: the Exception
 * Queue's open and in-progress items (all four FRS checks), plus repair lines
 * whose declaration was Flagged — assessed not repairable, sent anyway.
 *
 * Items raised before Spares Automation are left out: there is nothing anyone
 * can do about them.
 */
export function getInitiative8GlobalActions(): GlobalAction[] {
  const actions: GlobalAction[] = []

  for (const e of BASE_SNAPSHOT.exceptions) {
    if (e.preAutomation || (e.status !== "OPEN" && e.status !== "IN_PROGRESS")) continue
    actions.push({
      id: `i8-${e.id}`,
      initiative: "initiative-8",
      title: `${exceptionTypeLabel(e.type)} — ${e.material.materialId} (${e.title})`,
      severity: e.severity,
      entityId: e.id,
      materialId: e.material.materialId,
      plantId: e.plant.plantId,
      href: `/repairable-spares/exceptions?id=${e.id}`,
      createdAt: e.raisedAt,
    })
  }

  for (const line of BASE_SNAPSHOT.lines) {
    if (line.declarationStatus !== "Flagged") continue
    actions.push({
      id: `i8-flagged-${line.id}`,
      initiative: "initiative-8",
      title: `Declared ${line.condition} but sent for repair — ${line.material.materialId} (${line.id})`,
      severity: "critical",
      entityId: line.id,
      materialId: line.material.materialId,
      plantId: line.plant.plantId,
      href: `/repairable-spares/repair-register/${line.id}`,
      createdAt: line.declaredAt?.replace(/,.*$/, "") ?? line.raisedAt,
    })
  }

  return actions
}
