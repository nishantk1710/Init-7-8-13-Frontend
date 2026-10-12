import type { Material360Signal } from "@demo/lib/domain/contracts"
import { getRepairChainByMaterialId } from "@demo/features/initiative-8/data/repair-chains"
import { initiative8Manifest } from "@demo/features/initiative-8/manifest"
import { STAGE_LABEL, isOpenRepair } from "@demo/features/initiative-8/utils/status"

/**
 * Returns a repair-line summary for the global Material 360 drawer, and for
 * Initiative 7's repair-context notice. Read-only presentation data; null for
 * a material with no repair line.
 */
export function getInitiative8Material360Signal(materialId: string): Material360Signal | null {
  const chain = getRepairChainByMaterialId(materialId)
  if (!chain) return null

  const open = isOpenRepair(chain)
  const status: Material360Signal["status"] =
    chain.declarationStatus === "Flagged"
      ? "critical"
      : chain.overdueStatus === "OVERDUE"
        ? "attention"
        : open
          ? "neutral"
          : "healthy"

  return {
    initiative: "initiative-8",
    label: initiative8Manifest.name,
    href: `/repairable-spares/repair-register/${chain.id}`,
    status,
    lines: [
      { label: "Repair status", value: `${chain.repairStatus} — ${chain.vendor}` },
      { label: "Stage", value: `${STAGE_LABEL[chain.stage]} since ${chain.stageEnteredAt}` },
      { label: "Qty under repair", value: String(chain.qtyUnderRepair) },
      {
        label: open ? "Expected return" : chain.scrappedAt ? "Scrapped" : "Received",
        value: open
          ? (chain.expectedReturn ?? "No date agreed")
          : (chain.scrappedAt ?? chain.receivedAt ?? "—"),
      },
      { label: "Declaration", value: chain.declarationStatus },
    ],
  }
}
