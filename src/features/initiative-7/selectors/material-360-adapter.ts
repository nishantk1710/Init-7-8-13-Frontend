import type { Material360Signal } from "@/lib/domain/contracts"
import { getRecommendationsForMaterial } from "@/features/initiative-7/data/recommendations"
import { initiative7Manifest } from "@/features/initiative-7/manifest"

const RISK_TO_STATUS = {
  low: "healthy",
  medium: "attention",
  high: "attention",
  critical: "critical",
} as const

/**
 * Returns the most relevant open (or most recent) Initiative 7 recommendation
 * for a material, presented as a Material360Signal. Read-only — called by
 * the global Material360Drawer.
 */
export function getInitiative7Material360Signal(materialId: string): Material360Signal | null {
  const recs = getRecommendationsForMaterial(materialId)
  if (recs.length === 0) return null

  const rec =
    recs.find((r) => r.status === "Pending Review" || r.status === "In Approval" || r.status === "Returned") ??
    recs[0]

  return {
    initiative: "initiative-7",
    label: initiative7Manifest.name,
    href: `/inventory-planning/recommendations/${rec.id}`,
    status: RISK_TO_STATUS[rec.risk],
    lines: [
      { label: "Recommendation status", value: rec.status },
      { label: "Stockout risk", value: rec.risk.charAt(0).toUpperCase() + rec.risk.slice(1) },
      {
        label: "Recommended ROP / Safety Stock / Max",
        value: `${rec.recommended.rop} / ${rec.recommended.safetyStock} / ${rec.recommended.maxStock}`,
      },
      {
        label: "Current ROP / Safety Stock / Max",
        value: `${rec.current.rop} / ${rec.current.safetyStock} / ${rec.current.maxStock}`,
      },
    ],
  }
}
