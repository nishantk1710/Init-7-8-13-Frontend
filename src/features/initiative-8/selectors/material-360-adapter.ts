import type { Material360Signal } from "@/lib/domain/contracts"
import { getRepairChainByMaterialId } from "@/features/initiative-8/data/repair-chains"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { UNKNOWN, isRepairOverdue, vendorLabel } from "@/features/initiative-8/utils/status"

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
  const isOverdue = isRepairOverdue(chain)

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
      { label: "Repair status", value: `${chain.repairStatus} — ${vendorLabel(chain)}` },
      { label: "Qty under repair", value: String(chain.qtyUnderRepair) },
      {
        // An undated line says so rather than showing a blank cell: it is the
        // one the planner most needs to chase.
        label: isClosed ? "Received" : "Expected return",
        value: isClosed
          ? (chain.receivedAt ?? UNKNOWN)
          : (chain.expectedReturn ?? "No date agreed"),
      },
      { label: "Repair PO", value: chain.repairPO?.documentNumber ?? "Not yet raised (Simulated)" },
    ],
  }
}
