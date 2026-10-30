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
  /** Too little history to classify (the backend's UNCLASSIFIED: under the
   * history gate, so OAR similarity handles the material instead). */
  | "Cold start"
  /** The backend sent no demand class at all, or one this app does not know. */
  | "Unclassified"

/** How a recommendation was worked out: OAR (sized from similar materials),
 * Declining (demand has been falling, so TSB is used) or Normal. The three
 * never overlap; this is the split the Type filter makes. */
export type RecommendationType = "OAR" | "Declining" | "Normal"

export const DEMAND_PATTERNS: DemandPattern[] = [
  "Smooth",
  "Erratic",
  "Slow-Moving",
  "Lumpy",
  "Intermittent",
  "Cold start",
]

export const DEMAND_PATTERN_NOTE: Record<DemandPattern, string> = {
  Smooth: "frequent, low-variability withdrawals — classical (s, S) models fit well",
  Erratic: "frequent withdrawals with high variability in quantity",
  "Slow-Moving": "infrequent withdrawals, low variability when they occur",
  Lumpy: "infrequent withdrawals with high variability in quantity — the hardest pattern to forecast",
  Intermittent: "sporadic, low-volume withdrawals separated by long gaps",
  "Cold start": "too little consumption history to classify — sized from similar materials (OAR)",
  Unclassified: "no demand class available",
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
 * confidence context -- it plays no part in eligibility. The backend's rule is
 * now an AND of usage (more than `consumptionCountThreshold` issues in the last
 * `consumptionCountMonths` months) and a CRITICAL/IMPACT tier, so an eligible
 * decision carries `CONSUMPTION_AND_CRITICALITY`; the two older single-condition
 * values can still arrive on recommendations made before it. */
export interface OarConversionInfo {
  isOar: boolean | null
  conversionEligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN" | null
  conversionTrigger:
    | "CONSUMPTION_AND_CRITICALITY"
    | "CONSUMPTION_FREQUENCY"
    | "PRODUCTION_IMPACT"
    | "NONE"
    | "UNKNOWN"
    | null
  conversionDetail: string | null
  demandClass: string | null
  /** Issue transactions over the window below. The name says 12 for historical reasons; label it
   * with `consumptionCountMonths`, never with a fixed period. */
  consumptionCount12m: number | null
  /** How many months `consumptionCount12m` covers, as recorded when the recommendation was made.
   * Null/absent for one made before it was recorded: then no period is claimed. */
  consumptionCountMonths?: number | null
  consumptionCountThreshold: number | null
  /** Whether the criticality condition (CRITICAL/IMPACT) held -- null when it
   * could not be determined. */
  productionImpact: boolean | null
  /** Retired: the HOD trigger is no longer part of the rule, so this is null on
   * every current recommendation. Still read so older rows keep working. */
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
  /** Live API only: the material's own ZMM065 tier as the backend sent it
   * (CRITICAL / IMPACT / INSURANCE / NORMAL / OBSOLETE), upper-cased. `null` =
   * the material has no recorded tier. `undefined` = scenario fixture, which
   * only has the ordinal `criticality` above. Display this, not `criticality`,
   * wherever the user is asked to read a material's criticality. */
  criticalityTier?: string | null
  demandPattern: DemandPattern
  /** Live API only; absent on the scenario fixtures. */
  demandType?: RecommendationType
  /** Live list rows only: the backend's verdict on moving this OAR material to Min-Max
   * ordering (see OarConversionInfo). `null` when it has none; absent off the live list. */
  conversionEligibility?: OarConversionInfo["conversionEligibility"]
  risk: RiskLevel
  status: RecommendationStatus
  current: StockParameters
  recommended: StockParameters
  /** Which of the stock figures above the backend really sent. `current` and `recommended` turn a missing figure
   * into 0, which a side-by-side comparison must not read as "set to 0 in SAP"; this says which were there. Filled
   * by the list mapper only. */
  present?: { current: Record<keyof StockParameters, boolean>; recommended: Record<keyof StockParameters, boolean> }
  /** mean daily consumption used to derive expected lead-time demand */
  avgDailyConsumption: number
  leadTimeDays: number
  leadTimeVarianceDays: number
  serviceLevelTarget: number
  /** Live-API only: which of the numeric fields below the backend sent no
   * value for. They still hold 0 so existing arithmetic keeps working, but 0
   * is not a real service level, lead time or consumption -- readers must show
   * "Not available", never the 0. */
  unavailable?: Array<"leadTime" | "serviceLevel" | "consumption">
  /** Backend-computed Z-factor for serviceLevelTarget (Phase 5's own
   * inventory.service_level.resolve() result), read verbatim. Only present
   * on live-API recommendations; when absent, callers fall back to the
   * client-side illustrative approximation (see utils/inventory-calc.ts). */
  zFactor?: number | null
  unitPrice: number
  /** ISO code unitPrice and workingCapitalImpact are in, from SAP (MBEW
   * WAERS) on live-API recommendations; `null` when SAP supplied none;
   * absent on the scenario fixtures, which are ZAR. Format with formatMoney. */
  currency?: string | null
  annualConsumption: number
  /** Unit price x (current ROP - recommended ROP), from the backend -- the Working Capital Impact card's rule.
   * Positive releases working capital (reorder point reduced), negative is additional investment. `null` when it
   * could not be calculated (blocked, no price, no reorder point): not 0, which would claim "no change". */
  workingCapitalImpact: number | null
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
