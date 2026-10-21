import { BASE_SNAPSHOT } from "@demo/features/initiative-8/model/snapshot"
import type { RepairChain, RepairStatus } from "@demo/features/initiative-8/types/repair"
import { NO_CRITICALITY, REPAIR_STATUS_ORDER, isOpenRepair } from "@demo/features/initiative-8/utils/status"

export { REFERENCE_DATE } from "@demo/features/initiative-8/data/config"

/**
 * The repair register's lines as shipped — what code outside the Initiative 8
 * screens reads (Home, Action Center, Audit Trail, Material 360, Initiative
 * 7's repair signal). The screens themselves read `useI08Snapshot()`, which
 * adds whatever the viewer has done this session.
 *
 * The lines are built in `model/snapshot.ts` from the facts in
 * `data/repair-lines.ts`.
 */
export const REPAIR_CHAINS: RepairChain[] = BASE_SNAPSHOT.lines

export function getRepairChainById(id: string): RepairChain | undefined {
  return REPAIR_CHAINS.find((rc) => rc.id === id)
}

/** The material's open repair line, or its latest one when none is open. */
export function getRepairChainByMaterialId(materialId: string): RepairChain | undefined {
  const lines = REPAIR_CHAINS.filter((rc) => rc.material.materialId === materialId)
  return lines.find(isOpenRepair) ?? lines[0]
}

export const REPAIR_VENDORS = Array.from(new Set(REPAIR_CHAINS.map((rc) => rc.vendor))).sort()

/** Plants the register can filter by, taken from the rows themselves. */
export const REPAIR_PLANTS = Array.from(
  new Map(REPAIR_CHAINS.map((rc) => [rc.plant.plantId, rc.plant])).values(),
).sort((a, b) => a.name.localeCompare(b.name))

/** The repair statuses that occur in the rows, in lifecycle order. */
export const REPAIR_STATUS_OPTIONS: RepairStatus[] = REPAIR_STATUS_ORDER.filter((s) =>
  REPAIR_CHAINS.some((rc) => rc.repairStatus === s),
)

const CRITICALITY_ORDER = ["CRITICAL", "IMPACT", "INSURANCE", "NORMAL", "OBSOLETE"]

/** Ratings present, most severe first, then "Not recorded" when any line is unrated. */
export const CRITICALITY_OPTIONS: string[] = [
  ...CRITICALITY_ORDER.filter((c) => REPAIR_CHAINS.some((rc) => rc.criticality === c)),
  ...(REPAIR_CHAINS.some((rc) => !rc.criticality) ? [NO_CRITICALITY] : []),
]
