// The Spares AI Material Router — the single deterministic place that
// decides which initiative "owns" a material once it's been identified in
// the Material Assistant (chat) or the Material 360 drawer. This is the one
// sanctioned file (alongside `lib/aggregation.ts`) allowed to import across
// all three initiatives' data/selectors — no initiative page or component
// should re-implement this precedence logic itself.
//
// Precedence (see PROMPT_SPEC / master refactor prompt, "Material router"):
//   1. OAR material?               -> Initiative 13
//   2. Repairable (80-series)?     -> Initiative 8
//   3. In Initiative 7 opt. scope? -> Initiative 7
//   4. otherwise                   -> no initiative-specific workflow
//
// OAR takes precedence over repairable/I7-scope even when a material also
// carries a repair chain or an I7 recommendation (e.g. 500-14892 has all
// three) — a material still marked "Order as Required" is not yet a
// candidate for repair economics or reorder-point tuning until it's been
// reclassified (see Initiative 13's reclassification-to-I7 handoff).

import type { InitiativeId } from "@/lib/domain/contracts"
import { isOARMaterial } from "@/features/initiative-13/selectors/oar-lookup"
import { getInitiative13Material360Signal } from "@/features/initiative-13/selectors/material-360-adapter"
import { initiative13Manifest } from "@/features/initiative-13/manifest"
import { getRepairChainByMaterialId } from "@/features/initiative-8/data/repair-chains"
import { getInitiative8Material360Signal } from "@/features/initiative-8/selectors/material-360-adapter"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import {
  getRecommendationsForMaterial,
} from "@/features/initiative-7/data/recommendations"
import { getInitiative7Material360Signal } from "@/features/initiative-7/selectors/material-360-adapter"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { materialRef as oarMaterialRef } from "@/features/initiative-13/data/materials"
import type { Material360Signal } from "@/lib/domain/contracts"
import { getMaterialById } from "@/lib/shared-data/material-catalog"

export type MaterialRouteReason = "oar" | "repairable" | "optimization-scope" | "none"

export interface MaterialRoute {
  initiative: InitiativeId | null
  reason: MaterialRouteReason
  /** Product-facing routing label, e.g. "Refurbishable Spares" — never the
   * internal "Initiative N" codename (see each manifest's product name). */
  label: string
}

// Product-facing names only — never "Initiative N —", which is an internal
// program codename, not end-user-facing product language.
const ROUTE_LABEL: Record<InitiativeId, string> = {
  "initiative-13": initiative13Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-7": initiative7Manifest.name,
}

/**
 * Mock identification convention for repairable spares — the 80-series
 * material-number convention (e.g. "800-45210", "80003421"). This is a mock
 * convention only; the real SAP field mapping is still subject to
 * confirmation (see repair-register README / PROMPT_SPEC).
 */
export function isRepairableMaterial(materialId: string): boolean {
  const digitsOnly = materialId.replace(/\D/g, "")
  return digitsOnly.startsWith("80") && getRepairChainByMaterialId(materialId) !== undefined
}

/** True when the material has an open Initiative 7 optimization recommendation. */
export function isI7ScopeMaterial(materialId: string): boolean {
  return getRecommendationsForMaterial(materialId).length > 0
}

/** The single source of truth for "which initiative owns this material." */
export function routeMaterial(materialId: string): MaterialRoute {
  if (isOARMaterial(materialId)) {
    return { initiative: "initiative-13", reason: "oar", label: ROUTE_LABEL["initiative-13"] }
  }
  if (isRepairableMaterial(materialId)) {
    return { initiative: "initiative-8", reason: "repairable", label: ROUTE_LABEL["initiative-8"] }
  }
  if (isI7ScopeMaterial(materialId)) {
    return { initiative: "initiative-7", reason: "optimization-scope", label: ROUTE_LABEL["initiative-7"] }
  }
  return { initiative: null, reason: "none", label: "No initiative-specific workflow" }
}

export interface MaterialClassification {
  materialId: string
  description: string
  /** Short classification line, e.g. "OAR — Order as Required" */
  classificationLabel: string
  route: MaterialRoute
  /** Read-only supporting detail from the owning initiative's own selector — never invented here. */
  signal: Material360Signal | null
}

/**
 * Resolves a display description for a material id, preferring the shared
 * catalog, then falling back to whichever initiative's own mock data knows
 * about it (80-series repairable spares and some OAR-only ids don't exist
 * in the shared catalog — see `lib/shared-data/material-catalog.ts`).
 */
export function resolveMaterialDescription(materialId: string): string {
  const catalogMaterial = getMaterialById(materialId)
  if (catalogMaterial) return catalogMaterial.description

  const repairChain = getRepairChainByMaterialId(materialId)
  if (repairChain) return repairChain.material.description

  const oarRef = oarMaterialRef(materialId)
  if (oarRef.description !== materialId) return oarRef.description

  const recs = getRecommendationsForMaterial(materialId)
  if (recs.length > 0) return recs[0].material.description

  return materialId
}

function classificationLabelFor(route: MaterialRoute): string {
  switch (route.reason) {
    case "oar":
      return "OAR — Order as Required"
    case "repairable":
      return "Non-OAR · Repairable spare — 80-series"
    case "optimization-scope":
      return "Non-OAR · Stocked material — inventory optimization scope"
    default:
      return "Non-OAR · Stocked material"
  }
}

function signalFor(route: MaterialRoute, materialId: string): Material360Signal | null {
  switch (route.initiative) {
    case "initiative-13":
      return getInitiative13Material360Signal(materialId)
    case "initiative-8":
      return getInitiative8Material360Signal(materialId)
    case "initiative-7":
      return getInitiative7Material360Signal(materialId)
    default:
      return null
  }
}

/** One-call resolver for the Material Assistant classification card. */
export function classifyMaterial(materialId: string): MaterialClassification {
  const route = routeMaterial(materialId)
  return {
    materialId,
    description: resolveMaterialDescription(materialId),
    classificationLabel: classificationLabelFor(route),
    route,
    signal: signalFor(route, materialId),
  }
}
