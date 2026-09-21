// W2.6b — Initiative 7: SAP + platform rows -> the Recommendation view model.
//
// Every field's origin is declared in RECOMMENDATION_SOURCES below, and
// TypeScript will not compile this file if one is missing. Read that map
// first: it is the honest account of what this screen is actually made of,
// and roughly a third of it has no upstream source at all today.

import type { Recommendation } from "@/features/initiative-7/types/inventory"
import type { Criticality, DemandPattern } from "@/features/initiative-7/types/inventory"
import type { SapRow } from "../client/decode-row"
import { isInScope } from "../scope"
import { loadPlatform, type PlatformRow } from "./platform-source"
import type { FieldSourceMap } from "./field-source"

export const RECOMMENDATION_SOURCES: FieldSourceMap<Recommendation> = {
  id: { from: "platform", file: "inventory_recommendations", column: "recommendation_id" },
  material: {
    from: "sap",
    entitySet: "MaterialSet",
    property: "Matnr",
    note: "description joined from MaterialDescriptionSet.Maktx",
  },
  plantId: { from: "sap", entitySet: "MaterialPlantSet", property: "Werks" },
  criticality: { from: "platform", file: "inventory_recommendations", column: "criticality" },
  demandPattern: { from: "platform", file: "inventory_recommendations", column: "demand_pattern" },
  status: { from: "platform", file: "inventory_recommendations", column: "status" },
  leadTimeDays: {
    from: "sap",
    entitySet: "MaterialPlantSet",
    property: "Plifz",
    note: "W2.9's lead-time source; platform column carries the same value today",
  },
  current: {
    from: "sap",
    entitySet: "MaterialPlantSet",
    property: "Minbe/Eisbe/Mabst",
    note: "reorder point, safety stock and max stock as currently maintained in SAP",
  },
  recommended: {
    from: "platform",
    file: "inventory_recommendations",
    column: "recommended_rop/recommended_safety_stock/recommended_max_stock",
  },
  annualConsumption: { from: "platform", file: "inventory_recommendations", column: "consumptions_12m" },
  generatedAt: { from: "platform", file: "inventory_recommendations", column: "created_on" },
  workflow: {
    from: "platform",
    file: "approvals",
    column: "approver_role/decision/decision_date",
    note: "one step per approval row for this recommendation",
  },
  avgDailyConsumption: { from: "derived", note: "annualConsumption / 365" },
  risk: { from: "derived", note: "from criticality plus the size of the change between current and recommended" },
  workingCapitalImpact: {
    from: "blocked",
    entitySet: "MaterialValuationSet",
    property: "Verpr",
    note: "needs unit price to compute; MaterialValuationSet returns zero rows live (§1.3)",
  },
  unitPrice: {
    from: "blocked",
    entitySet: "MaterialValuationSet",
    property: "Verpr",
    note: "moving average price. Zero rows live (§1.3), so this is 0 until SAP answers why",
  },
  consumptionHistory: {
    from: "blocked",
    entitySet: "GoodsMovementItemSet",
    note: "derivable from consumption movements, but needs the movement-type set confirmed (still a pending business constant)",
  },

  // ---- Genuine gaps. Nothing upstream produces these. ----
  circuit: {
    from: "gap",
    note: "Plant circuit (Crushing/Milling/Pumping/...). No SAP field carries it and no platform file produces it. Either it comes from a plant-master mapping VZI would have to supply, or the UI should stop showing it.",
  },
  factors: {
    from: "gap",
    note: "Human-readable 'why this recommendation' bullets. inventory_recommendations.reason holds ONE sentence, not the structured label/detail pairs the UI renders. Whatever generates recommendations must emit these.",
  },
  championChallenger: {
    from: "gap",
    note: "Champion/challenger model names, descriptions and accuracy percentages. Pure ML metadata — it can only come from the model-serving layer, which does not exist yet.",
  },
  oarColdStart: {
    from: "gap",
    note: "Similar-material suggestions and a confidence band for OAR materials with no history. An AI output, not a SAP read.",
  },
  serviceLevelTarget: {
    from: "gap",
    note: "Target service level per material. Not maintained in SAP and not in any platform file — needs a policy decision from VZI, likely by criticality band.",
  },
  leadTimeVarianceDays: {
    from: "gap",
    note: "Lead-time variability. MARC.PLIFZ is a single planned figure with no variance. Would have to be computed from PO history (EKET/EKBE) over time.",
  },
  scenarioNote: {
    from: "gap",
    note: "Demo-only annotation on the hand-written fixtures. Should not survive into real data.",
  },
  zFactor: {
    from: "gap",
    note: "Backend-computed Z-factor (Part 21, I07 frontend/backend integration) -- only populated by the live FastAPI backend's own service_level.z_factor (app/schemas/i7/recommendations.py), never by this SAP+platform mapping pipeline. Optional and absent here on purpose.",
  },
  rationale: {
    from: "gap",
    note: "AI-generated/deterministic-fallback rationale text and source (Part 21) -- populated only by the live backend's rationale.text/rationale.source, which this generated-dataset pipeline has no equivalent source for. Optional and absent here on purpose.",
  },
  updatedAt: {
    from: "gap",
    note: "When the recommendation row last changed status (submit/hold/approve/reject) -- populated only by the live backend's i7_recommendation.updated_at, used for pipeline waiting-time/stuck detection. This generated-dataset pipeline has no equivalent source for it. Optional and absent here on purpose.",
  },
}

const CRITICALITY_MAP: Record<string, Criticality> = {
  CRITICAL: "Critical",
  IMPACT: "High",
  INSURANCE: "Medium",
  NORMAL: "Low",
  OBSOLETE: "Low",
}

const DEMAND_PATTERN_MAP: Record<string, DemandPattern> = {
  REGULAR: "Smooth",
  ERRATIC: "Erratic",
  SLOW: "Slow-Moving",
  LUMPY: "Lumpy",
  INTERMITTENT: "Intermittent",
}

export interface Initiative7Input {
  recommendations: PlatformRow[]
  materials: Map<string, SapRow>
  materialPlants: Map<string, SapRow>
  descriptions: Map<string, string>
  approvals: PlatformRow[]
}

const numberOf = (value: string | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const asString = (value: unknown): string => (value === null || value === undefined ? "" : String(value))

/**
 * Map one platform recommendation plus its SAP context into the view model.
 * Fields declared `gap` above are returned empty — deliberately, and visibly.
 */
export function mapRecommendation(row: PlatformRow, input: Initiative7Input): Recommendation {
  const plantKey = `${row.Matnr}|${row.Werks}`
  const plant = input.materialPlants.get(plantKey) ?? {}
  const material = input.materials.get(row.Matnr) ?? {}

  const annualConsumption = numberOf(row.consumptions_12m)
  const recommendedRop = numberOf(row.recommended_rop)
  const currentRop = numberOf(row.current_rop)

  return {
    id: row.recommendation_id,
    material: {
      materialId: row.Matnr,
      materialCode: row.Matnr,
      description: input.descriptions.get(row.Matnr) ?? row.material_description ?? "",
    },
    plantId: row.Werks,
    criticality: CRITICALITY_MAP[row.criticality] ?? "Low",
    demandPattern: DEMAND_PATTERN_MAP[row.demand_pattern] ?? "Intermittent",
    status: mapStatus(row.status),
    current: {
      rop: numberOf(asString(plant.Minbe)) || currentRop,
      safetyStock: numberOf(asString(plant.Eisbe)) || numberOf(row.current_safety_stock),
      maxStock: numberOf(asString(plant.Mabst)) || numberOf(row.current_max_stock),
    },
    recommended: {
      rop: recommendedRop,
      safetyStock: numberOf(row.recommended_safety_stock),
      maxStock: numberOf(row.recommended_max_stock),
    },
    leadTimeDays: numberOf(asString(plant.Plifz)) || numberOf(row.lead_time_days),
    annualConsumption,
    avgDailyConsumption: annualConsumption / 365,
    risk: deriveRisk(row.criticality, currentRop, recommendedRop),
    workflow: [],
    generatedAt: row.created_on,

    // Blocked on SAP data that is registered but empty (§1.3).
    unitPrice: 0,
    workingCapitalImpact: 0,
    consumptionHistory: [],

    // Gaps — see RECOMMENDATION_SOURCES. Deliberately not invented: "Unassigned"
    // is a missing value, not a guess at which circuit this material belongs to.
    circuit: "Unassigned",
    factors: [],
    championChallenger: {
      champion: { name: "", description: "", accuracyPct: 0 },
      challenger: { name: "", description: "", accuracyPct: 0 },
      selected: "champion",
      rationale: "",
    },
    serviceLevelTarget: 0,
    leadTimeVarianceDays: 0,
  }
}

function mapStatus(status: string): Recommendation["status"] {
  switch (status) {
    case "APPROVED":
      return "Approved"
    case "REJECTED":
      return "Rejected"
    case "IMPLEMENTED":
      return "Implemented"
    case "IN_APPROVAL":
      return "In Approval"
    case "RETURNED":
      return "Returned"
    default:
      return "Pending Review"
  }
}

function deriveRisk(criticality: string, currentRop: number, recommendedRop: number): Recommendation["risk"] {
  if (criticality === "CRITICAL") return "critical"
  const change = currentRop === 0 ? 1 : Math.abs(recommendedRop - currentRop) / currentRop
  if (change > 0.5) return "high"
  if (change > 0.2) return "medium"
  return "low"
}

/** Recommendations for materials that are in OAR scope, decided ONLY via lib/sap/scope. */
export function oarRecommendations(input: Initiative7Input): PlatformRow[] {
  return input.recommendations.filter((row) => {
    const material = input.materials.get(row.Matnr) ?? {}
    const plant = input.materialPlants.get(`${row.Matnr}|${row.Werks}`) ?? {}
    return isInScope("oar", material, plant) === "in-scope"
  })
}

export function loadInitiative7Platform(): { recommendations: PlatformRow[]; approvals: PlatformRow[] } {
  return {
    recommendations: loadPlatform("inventory_recommendations"),
    approvals: loadPlatform("approvals"),
  }
}
