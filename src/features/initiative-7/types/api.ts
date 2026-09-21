// Part 21 — I07 frontend/backend integration.
//
// Types mirroring the real FastAPI response shapes verbatim (see the backend's
// app/schemas/i7/recommendations.py and app/schemas/i7/approvals.py). Every
// field here is read as-is from the wire, never recomputed -- these exist so
// the mapper in `services/i7-api.ts` has an exact, typed contract to convert
// from, not so the frontend has a second copy of the backend's own types.
//
// Decimal-typed backend fields (Pydantic `Decimal`) arrive as JSON STRINGS,
// not numbers -- confirmed against the live API ("0.000000", not 0). This is
// standard FastAPI/Pydantic Decimal-to-JSON behaviour (JSON has no exact
// decimal type, so Pydantic serializes as a string rather than a possibly
// lossy float). `ApiDecimal` documents this at every call site; the mapper
// in services/i7-api.ts converts via `toNumber()` for display only -- no
// arithmetic beyond formatting is performed on the result (see PART 21's
// architecture rule: the frontend must not recompute a business value).
export type ApiDecimal = string | number | null

export interface ApiStockParameters {
  safety_stock: ApiDecimal
  rop: ApiDecimal
  max_stock: ApiDecimal
}

export interface ApiConsumptionHistoryEntry {
  period: string
  quantity: ApiDecimal
}

export interface ApiDemandInfo {
  demand_class: string | null
  history_status: string | null
  model: string | null
  forecast_rate: ApiDecimal
  consumption_history: ApiConsumptionHistoryEntry[]
}

export interface ApiLeadTimeInfo {
  method: string | null
  days: ApiDecimal
  variance_days: ApiDecimal
}

export interface ApiCriticalityInfo {
  value: string | null
}

export interface ApiServiceLevelInfo {
  service_level: ApiDecimal
  z_factor: ApiDecimal
}

export interface ApiOarInfo {
  is_oar: boolean | null
  similarity_status: string | null
  estimate_status: string | null
  neighbour_count: number | null
  best_similarity: ApiDecimal
  confidence: string | null
  conversion_eligibility: string | null
  conversion_trigger: string | null
  conversion_detail: string | null
  demand_class: string | null
  consumption_count_12m: number | null
  consumption_count_threshold: number | null
  production_impact: boolean | null
  i13_hod_approved: boolean | null
}

export interface ApiRationaleInfo {
  text: string | null
  source: "AI_GENERATED" | "DETERMINISTIC_FALLBACK" | null
}

export interface ApiImpactInfo {
  status: string
  safety_stock_delta: ApiDecimal
  rop_delta: ApiDecimal
  max_stock_delta: ApiDecimal
}

export interface ApiGovernanceInfo {
  policy_id: string
  policy_version: number
  formula_version: string
  feature_run_id: number | null
  forecast_run_id: number | null
  inventory_run_id: number | null
  oar_run_id: number | null
}

/** One row of GET /recommendations -- see RecommendationSummary.
 * `current`/`recommended`/`impact` were added so the list's Value/ROP change
 * columns can render a real delta without a per-row detail fetch -- the list
 * endpoint's own query already loads the full recommendation row, so these
 * add no extra backend cost. */
export interface ApiRecommendationSummary {
  recommendation_id: string
  material: string
  plant: string
  status: string
  is_oar: boolean | null
  demand_class: string | null
  criticality: string | null
  confidence: string | null
  generated_at: string
  updated_at: string
  current: ApiStockParameters
  recommended: ApiStockParameters
  impact: ApiImpactInfo
  unit_price: ApiDecimal
}

export interface ApiRecommendationListResponse {
  items: ApiRecommendationSummary[]
  total: number
  page: number
  page_size: number
}

/** GET /recommendations/summary -- see RecommendationSummaryStats. Every
 * count/sum here is a portfolio-wide SQL aggregate, never paginated and
 * never recomputed client-side. */
export interface ApiStatusCount {
  status: string
  count: number
}

export interface ApiCriticalityCount {
  criticality: string | null
  count: number
}

export interface ApiCircuitCount {
  circuit: string | null
  count: number
}

export interface ApiRiskCount {
  risk: string
  count: number
}

export interface ApiPlantCount {
  plant: string
  count: number
}

export interface ApiRecommendationSummaryStats {
  total: number
  by_status: ApiStatusCount[]
  by_criticality: ApiCriticalityCount[]
  by_circuit: ApiCircuitCount[]
  by_risk: ApiRiskCount[]
  by_plant: ApiPlantCount[]
  oar_count: number
  normal_count: number
  awaiting_approval_count: number
  ready_for_review_count: number
  not_evaluable_count: number
  net_safety_stock_value_impact: ApiDecimal
}

/** GET /recommendations/{id} -- see RecommendationDetail. */
export interface ApiRecommendationDetail {
  recommendation_id: string
  material: string
  plant: string
  circuit: string | null
  unit_price: ApiDecimal
  current: ApiStockParameters
  recommended: ApiStockParameters
  demand: ApiDemandInfo
  lead_time: ApiLeadTimeInfo
  criticality: ApiCriticalityInfo
  service_level: ApiServiceLevelInfo
  oar: ApiOarInfo
  impact: ApiImpactInfo
  rationale: ApiRationaleInfo
  governance: ApiGovernanceInfo
  status: string
  blocking_reason: string | null
  safety_stock_method: string | null
  max_stock_strategy: string | null
  chain_index: number
  adjustment_count: number
  current_version: number
  generated_at: string
  updated_at: string
}

/** GET /recommendations/{id}/trace -- see RecommendationTrace. */
export interface ApiRecommendationTrace {
  recommendation_id: string
  status: string
  blocking_reason: string | null
  factors: string[]
  entries: { label: string; value: string }[]
}

// --- Approvals --------------------------------------------------------

/** Matches app.initiatives.i7.recommendations.types.ApprovalRole exactly --
 * a raw string value the backend enum serializes to. Kept as a plain string
 * union (not re-deriving business meaning) since the frontend never decides
 * which role applies -- it only submits the role the acting user picked. */
export type ApiApprovalRole =
  | "End User"
  | "Engineering Manager"
  | "Commercial Manager"
  | "Warehouse Supervisor"
  | "Inventory Controller"
  | "Commercial Head"
  | "Engineering Head"
  | "Plant Head"

export type ApiApprovalAction =
  | "APPROVE"
  | "REJECT"
  | "SEND_BACK"
  | "ADJUST"
  | "HOLD"
  | "RELEASE_HOLD"

export interface ApiWorkflowStateResponse {
  recommendation_id: string
  status: string
  pending_role: string | null
  route: string[]
  chain_index: number
  adjustment_count: number
  current_version: number
}

export interface ApiApprovalHistoryEntry {
  recommendation_id: string
  recommendation_version: number
  actor_id: string
  actor_role: string
  action: string
  previous_status: string
  new_status: string
  comment: string | null
  timestamp: string
}

export interface ApiApprovalHistoryResponse {
  recommendation_id: string
  items: ApiApprovalHistoryEntry[]
}

// --- Adoption tracking (FR-9) --------------------------------------------
//
// GET /v1/i7/recommendations/adoption -- portfolio-wide, and GET
// /v1/i7/recommendations/{id}/adoption -- one recommendation. Both read the
// same read-only SAP change-document reconciliation (see
// app/api/i7/adoption.py); status is exactly ADOPTED / PARTIALLY_ADOPTED /
// NOT_ADOPTED / UNKNOWN, never collapsed the way mapStatus() collapses it
// elsewhere in this file -- adoption tracking is the one place those three
// distinct backend values are shown as themselves.

export interface ApiAdoptionListItem {
  recommendation_id: string
  sap_material_number: string
  sap_plant_code: string
  status: string
  is_conversion_adoption: boolean
  detail: string
}

export interface ApiAdoptionListResponse {
  items: ApiAdoptionListItem[]
  total: number
  page: number
  page_size: number
}

export interface ApiAdoptionResponse {
  recommendation_id: string
  status: string
  expected: Record<string, string>
  observed: Record<string, string>
  matched_fields: string[]
  mismatched_fields: string[]
  detail: string
  is_conversion_adoption: boolean
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}
