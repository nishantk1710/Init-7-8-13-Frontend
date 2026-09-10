import type { Material360Signal } from "@/lib/domain/contracts"
import { getLedgerLinesByMaterial } from "@/features/initiative-13/data/ledger"
import { RECLASSIFICATION_CANDIDATES } from "@/features/initiative-13/data/reclassification"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

/**
 * Returns a utilization/aging status summary for materials with OAR
 * utilization history, or `null` otherwise. Called by the global
 * Material360Drawer — read-only presentation data only.
 */
export function getInitiative13Material360Signal(materialId: string): Material360Signal | null {
  const lines = getLedgerLinesByMaterial(materialId)
  if (lines.length === 0) return null

  const overdue = lines.filter((l) => l.exception === "Consumption Overdue").length
  const redeployable = lines.filter((l) => l.exception === "No Longer Required").length
  const unutilizedQty = lines.reduce((sum, l) => sum + Math.max(l.qtyRequested - l.qtyConfirmedUsed, 0), 0)
  const reclassification = RECLASSIFICATION_CANDIDATES.find((c) => c.material.materialId === materialId)

  const status = overdue > 0 ? "attention" : redeployable > 0 ? "attention" : "healthy"

  return {
    initiative: "initiative-13",
    label: initiative13Manifest.name,
    href: "/oar-utilization/ledger",
    status,
    lines: [
      { label: "Open OAR lines", value: String(lines.length) },
      { label: "Unutilized qty", value: String(unutilizedQty) },
      { label: "Overdue confirmations", value: String(overdue) },
      { label: "Available for redeployment", value: String(redeployable) },
      ...(reclassification
        ? [{ label: "Reclassification", value: reclassification.recommendation }]
        : []),
    ],
  }
}
