import type { ActionSeverity, GlobalAction } from "@/lib/domain/contracts"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { isOpenRecommendation } from "@/features/initiative-7/utils/inventory-calc"

function severityFor(rec: (typeof RECOMMENDATIONS)[number]): ActionSeverity {
  if (rec.risk === "critical") return "critical"
  if (rec.risk === "high") return "warning"
  return "info"
}

function actionTitle(rec: (typeof RECOMMENDATIONS)[number]): string {
  if (rec.status === "Returned") {
    return `Recommendation returned — ${rec.material.description}`
  }
  return `ROP recommendation awaiting approval — ${rec.material.description}`
}

/**
 * Every open Initiative 7 recommendation (Pending Review / In Approval /
 * Returned) surfaced in the global Action Center.
 */
export function getInitiative7GlobalActions(): GlobalAction[] {
  return RECOMMENDATIONS.filter(isOpenRecommendation).map((rec) => ({
    id: `i7-${rec.id}`,
    initiative: "initiative-7",
    title: actionTitle(rec),
    severity: severityFor(rec),
    entityId: rec.id,
    materialId: rec.material.materialId,
    plantId: rec.plantId,
    href: `/inventory-planning/recommendations/${rec.id}`,
    createdAt: rec.generatedAt,
  }))
}
