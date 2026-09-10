// Material lookups for Initiative 13's OAR scenarios. Prefers real Initiative
// 9 catalog materials (via `@/lib/shared-data/material-catalog`) for
// cross-initiative cohesion; falls back to a small set of synthetic
// OAR-only materials that don't exist in the shared catalog (per that
// module's guidance — initiative-specific materials live locally).

import type { MaterialReference } from "@/lib/domain/contracts"
import { getMaterialById } from "@/lib/shared-data/material-catalog"

const SYNTHETIC_MATERIALS: Record<string, { description: string; unitPrice: number }> = {
  "OAR-77002": { description: "Coupling, Flexible Gear, Type GC-220", unitPrice: 22400 },
}

export function materialRef(materialId: string): MaterialReference {
  const catalogMaterial = getMaterialById(materialId)
  if (catalogMaterial) {
    return {
      materialId: catalogMaterial.id,
      materialCode: catalogMaterial.id,
      description: catalogMaterial.description,
    }
  }
  const synthetic = SYNTHETIC_MATERIALS[materialId]
  return {
    materialId,
    materialCode: materialId,
    description: synthetic?.description ?? materialId,
  }
}

export function unitPriceFor(materialId: string): number {
  const catalogMaterial = getMaterialById(materialId)
  if (catalogMaterial) return catalogMaterial.lastPoPrice
  return SYNTHETIC_MATERIALS[materialId]?.unitPrice ?? 0
}
