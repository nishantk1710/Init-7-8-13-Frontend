// Initiative 7 domain types — ROP / safety-stock / max-stock recommendation
// workspace. Cross-initiative shapes (MaterialReference, GlobalAction,
// AuditEvent, Material360Signal) come from `@/lib/domain/contracts` and are
// never redefined here; this file is purely Initiative 7's own richer model.

import type { MaterialReference } from "@/lib/domain/contracts"
import type { WorkflowStep } from "@/components/shared/workflow-stepper"
import type { RiskLevel } from "@/components/shared/risk-badge"

export type Circuit =
  | "Crushing"
  | "Milling"
  | "Pumping"
  | "Filtration"
  | "Conveying"
  | "Flotation"
  /**
   * No source produces circuit for a real material — see the WS2 gap report
   * (the removed `npm run gap-report`; see backend/docs for the field-source analysis). Rather than defaulting mapped rows into a real
   * circuit and quietly reporting every material as, say, Crushing, they carry
   * this. Deliberately absent from CIRCUITS below, so it is never offered as a
   * filter option — it is a missing value, not a category.
   */
  | "Unassigned"

export const CIRCUITS: Circuit[] = [
  "Crushing",
  "Milling",
  "Pumping",
  "Filtration",
  "Conveying",
  "Flotation",
]

export type Criticality = "Low" | "Medium" | "High" | "Critical"

export const CRITICALITIES: Criticality[] = ["Low", "Medium", "High", "Critical"]

export type DemandPattern =
  | "Smooth"
  | "Erratic"
  | "Slow-Moving"
  | "Lumpy"
  | "Intermittent"

export const DEMAND_PATTERNS: DemandPattern[] = [
  "Smooth",
  "Erratic",
  "Slow-Moving",
  "Lumpy",
  "Intermittent",
]

export const DEMAND_PATTERN_NOTE: Record<DemandPattern, string> = {
  Smooth: "frequent, low-variability withdrawals — classical (s, S) models fit well",
  Erratic: "frequent withdrawals with high variability in quantity",
  "Slow-Moving": "infrequent withdrawals, low variability when they occur",
  Lumpy: "infrequent withdrawals with high variability in quantity — the hardest pattern to forecast",
  Intermittent: "sporadic, low-volume withdrawals separated by long gaps",
}

export type RecommendationStatus =
  | "Pending Review"
  | "In Approval"
  | "Approved"
  | "Rejected"
  | "Returned"
  | "Implemented"

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  "Pending Review",
  "In Approval",
  "Approved",
  "Rejected",
  "Returned",
  "Implemented",
]

export interface StockParameters {
  rop: number
  safetyStock: number
  maxStock: number
}

export interface ModelProfile {
  name: string
  description: string
  accuracyPct: number
}

export interface ChampionChallenger {
  champion: ModelProfile
  challenger: ModelProfile
  selected: "champion" | "challenger"
  rationale: string
}

export interface RecommendationFactor {
  label: string
  detail: string
}

export interface ConsumptionPoint {
  period: string
  qty: number
}

export interface OarColdStartGuidance {
  similarMaterials: string[]
  suggestedRop: number
  suggestedSafetyStock: number
  confidence: "Low" | "Medium" | "High"
  factors: string[]
  note: string
}

/** OAR-to-Min-Max conversion suggestion (FRS SOP 3.1.1), read verbatim from
 * the backend's OarInfo/conversion.evaluate() result -- never recomputed or
 * re-triggered in the frontend. Only meaningful when `isOar` is true; a
 * non-OAR (Min-Max) recommendation has no conversion decision to show.
 * `demandClass` is FR-2's pattern, carried here purely as supporting/
 * confidence context -- it is not one of the three OR'd triggers. */
export interface OarConversionInfo {
  isOar: boolean | null
  conversionEligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN" | null
  conversionTrigger: "CONSUMPTION_FREQUENCY" | "PRODUCTION_IMPACT" | "I13_HOD_APPROVED_REQUEST" | "NONE" | "UNKNOWN" | null
  conversionDetail: string | null
  demandClass: string | null
  consumptionCount12m: number | null
  consumptionCountThreshold: number | null
  /** Trigger 2 (criticality/tier) evidence -- null when unresolved. */
  productionImpact: boolean | null
  /** null when the I13 HOD ledger has no data for this material-plant yet
   * (the stub's honest "unknown", never a fabricated false). */
  i13HodApproved: boolean | null
}

/** AI-generated (or deterministic-fallback) explanation, read verbatim from
 * the backend — never generated or recomputed in the frontend. Present only
 * on recommendations sourced from the live API (see `services/i7-api.ts`);
 * scenario/generated fixtures have no equivalent field. */
export interface RationaleInfo {
  text: string | null
  source: "AI_GENERATED" | "DETERMINISTIC_FALLBACK" | null
}

export interface Recommendation {
  id: string
  material: MaterialReference
  plantId: string
  circuit: Circuit
  criticality: Criticality
  demandPattern: DemandPattern
  risk: RiskLevel
  status: RecommendationStatus
  current: StockParameters
  recommended: StockParameters
  /** mean daily consumption used to derive expected lead-time demand */
  avgDailyConsumption: number
  leadTimeDays: number
  leadTimeVarianceDays: number
  serviceLevelTarget: number
  /** Backend-computed Z-factor for serviceLevelTarget (Phase 5's own
   * inventory.service_level.resolve() result), read verbatim. Only present
   * on live-API recommendations; when absent, callers fall back to the
   * client-side illustrative approximation (see utils/inventory-calc.ts). */
  zFactor?: number | null
  unitPrice: number
  annualConsumption: number
  /** ZAR — positive releases working capital (stock reduced), negative is additional investment */
  workingCapitalImpact: number
  consumptionHistory: ConsumptionPoint[]
  factors: RecommendationFactor[]
  championChallenger: ChampionChallenger
  workflow: WorkflowStep[]
  oarColdStart?: OarColdStartGuidance
  /** Only present on live-API recommendations (see mapDetailToRecommendation
   * in services/i7-api.ts) -- absent for scenario/generated fixtures. */
  oarConversion?: OarConversionInfo
  generatedAt: string
  /** When this recommendation's row last changed (submit/hold/approve/reject
   * all update the existing row in place) -- the correct "waiting since"
   * anchor for pipeline/stuck-detection views. Only present on live-API
   * recommendations; scenario mode derives its own waiting time from
   * workflow-context state instead (see pipeline-workspace.tsx). */
  updatedAt?: string
  scenarioNote?: string
  /** Only present on live-API recommendations. */
  rationale?: RationaleInfo
  /** The approval role whose decision this recommendation is next waiting
   * on, or null once it has left the approval chain (approved/rejected/not
   * yet submitted). Derived server-side from status + chain_index + route
   * (see RecommendationSummary.route's docstring on the backend) -- only
   * present on live-API recommendations. */
  pendingRole?: string | null
  /** Index into `routeLength` of the role above -- "step chainIndex of
   * routeLength" for a pipeline progress indicator. Only present on
   * live-API recommendations. */
  chainIndex?: number
  /** Length of this recommendation's resolved approval route -- varies by
   * criticality tier/OAR routing, so never assume a fixed constant (see
   * RecommendationSummary.route's docstring). Only present on live-API
   * recommendations. */
  routeLength?: number
}
