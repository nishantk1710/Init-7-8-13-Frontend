import type { Material360Signal } from "@/lib/domain/contracts"
import { getRepairChainByMaterialId } from "@/features/initiative-8/data/repair-chains"
import { initiative8Manifest } from "@/features/initiative-8/manifest"

/**
 * Returns a repair-chain summary for the global Material 360 drawer.
 * Read-only presentation data — also called directly by Initiative 7's
 * recommendation-detail page for material `500-14892`, which must resolve to
 * a real, non-null signal here (see `data/repair-chains.ts` RC-8002).
 */
export function getInitiative8Material360Signal(materialId: string): Material360Signal | null {
  const chain = getRepairChainByMaterialId(materialId)
  if (!chain) return null

  const isClosed = chain.repairStatus === "Closed"
  const isOverdue = !isClosed && chain.daysRemainingInRepair < 0

  const status: Material360Signal["status"] =
    chain.declarationStatus === "Flagged"
      ? "critical"
      : isOverdue
        ? "attention"
        : isClosed
          ? "healthy"
          : "neutral"

  return {
    initiative: "initiative-8",
    label: initiative8Manifest.name,
    href: `/repairable-spares/repair-register/${chain.id}`,
    status,
    lines: [
      { label: "Repair status", value: `${chain.repairStatus} — ${chain.vendor}` },
      { label: "Qty under repair", value: String(chain.qtyUnderRepair) },
      {
        label: isClosed ? "Received" : "Expected return",
        value: isClosed ? (chain.receivedAt ?? "—") : chain.expectedReturn,
      },
      { label: "Repair PO", value: chain.repairPO?.documentNumber ?? "Not yet raised (Simulated)" },
    ],
  }
}
