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
  /** MAKT material description, joined server-side from i7_staged_material.
   * Null when MAKT has no row for the material. */
  description: string | null
  plant: string
  status: string
  is_oar: boolean | null
  /** OAR, DECLINING or NORMAL -- three groups that never overlap. */
  demand_type?: string
  demand_class: string | null
  criticality: string | null
  confidence: string | null
  /** ELIGIBLE / NOT_ELIGIBLE / UNKNOWN for an OAR row; absent from a backend that predates it. */
  conversion_eligibility?: string | null
  generated_at: string
  updated_at: string
  chain_index: number
  route: string[]
  current: ApiStockParameters
  recommended: ApiStockParameters
  impact: ApiImpactInfo
  unit_price: ApiDecimal
  /** ISO code unit_price is in (SAP MBEW WAERS); null when SAP supplied none. */
  currency?: string | null
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
  /** Currency of every money figure here, when all priced materials share one. */
  currency?: string | null
  net_safety_stock_value_impact: ApiDecimal
  /** SUM(unit_price * (current_rop - recommended_rop)) -- the Overview's Working Capital Impact. */
  net_rop_value_impact?: ApiDecimal
  critical_stockout_risk_count: number
  /** Fast / Slow material-plants that could be judged -- the denominator of the stockout share. */
  stockout_risk_evaluated_count?: number
  /** Fast / Slow material-plants with no lead time or no stock on hand (Insufficient Data). */
  stockout_risk_insufficient_data_count?: number
  /** ISO date the consumption and bands were read as of; null when the usage has not been built. */
  stockout_risk_as_of?: string | null
  excess_inventory_candidates_count: number
  excess_inventory_opportunity: ApiDecimal
}

/** GET /recommendations/{id} -- see RecommendationDetail. */
export interface ApiRecommendationDetail {
  recommendation_id: string
  material: string
  /** MAKT material description -- see ApiRecommendationSummary.description. */
  description: string | null
  plant: string
  circuit: string | null
  unit_price: ApiDecimal
  currency?: string | null
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

/** GET /recommendations/{id}/forecast-history -- the champion model's real
 * rolling-origin predicted/actual pairs (i7_forecast_backtest_path, added
 * 2026-09-22). points is empty when no forecast run since the table shipped
 * has produced paths for this material-plant -- never fabricated. */
export interface ApiForecastHistoryPoint {
  forecast_period: string
  predicted: ApiDecimal
  actual: ApiDecimal
}

/** GET /v1/i7/forecast-vs-actual -- per month, the SUM of the champion models'
 * one-step-ahead predictions and of actual demand, across the material-plants
 * with a persisted backtest in the latest succeeded forecast run. */
export interface ApiForecastVsActualPoint {
  forecast_period: string
  predicted: ApiDecimal
  actual: ApiDecimal
  material_count: number
}

export interface ApiForecastVsActualResponse {
  materials_with_history_count: number
  materials_in_scope_count: number
  points: ApiForecastVsActualPoint[]
}

export interface ApiForecastHistoryResponse {
  sap_material_number: string
  sap_plant_code: string
  model_name: string | null
  points: ApiForecastHistoryPoint[]
}

export interface ApiSimilarMaterial {
  rank: number
  material: string
  plant: string
  description: string | null
  similarity: ApiDecimal | null
  criticality: string | null
  history_months: number | null
  /** I07's own calculation for the neighbour (what fed the estimate). */
  safety_stock: number | null
  rop: number | null
  max_stock: number | null
  /** What SAP holds for the neighbour now (MARC). Absent from a backend that predates it. */
  current_rop?: ApiDecimal
  current_safety_stock?: ApiDecimal
  current_max_stock?: ApiDecimal
  contributed: boolean
}

export interface ApiSimilarMaterialsResponse {
  sap_material_number: string
  sap_plant_code: string
  neighbours: ApiSimilarMaterial[]
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

/** One field an adoption check looked at: what was approved, what SAP held
 * before and holds now, and when it changed. */
export interface ApiAdoptionFieldRow {
  key: string
  label: string
  expected: string | null
  before: string | null
  now: string | null
  /** ISO date (YYYY-MM-DD) of the latest change. */
  changed_on: string | null
  /** HH:MM, null when the extract carried no usable time. */
  changed_time: string | null
  /** Whole days from approval (else the recommendation date) to the change. */
  days_after: number | null
  /** null when SAP recorded nothing about this field. */
  matched: boolean | null
}

export interface ApiAdoptionListItem {
  recommendation_id: string
  sap_material_number: string
  sap_plant_code: string
  status: string
  is_conversion_adoption: boolean
  detail: string
  check_type?: string
  fields?: ApiAdoptionFieldRow[]
  approved_on?: string | null
  window_ends_on?: string | null
  window_open?: boolean
  /** UNKNOWN while the tracking window is still open -- waiting for SAP. */
  pending?: boolean
}

export interface ApiAdoptionListResponse {
  items: ApiAdoptionListItem[]
  total: number
  page: number
  page_size: number
}

export interface ApiAdoptionStatusCount {
  status: string
  count: number
}

/** GET /v1/i7/recommendations/adoption/summary -- real COUNT/GROUP BY over
 * i7_sap_adoption, the persisted recommendation ledger, not a live
 * re-evaluation. Only reflects recommendations someone has actually viewed
 * through the adoption endpoints so far -- grows as more of the portfolio
 * is evaluated, never a claim about the whole portfolio on day one. */
export interface ApiAdoptionSummary {
  total_evaluated: number
  by_status: ApiAdoptionStatusCount[]
  adopted_count: number
  partially_adopted_count: number
  not_adopted_count: number
  unknown_count: number
  adoption_rate_percentage: number | null
}

export interface ApiAdoptionResponse {
  recommendation_id: string
  status: string
  expected: Record<string, string>
  observed: Record<string, string>
  matched_fields: string[]
  mismatched_fields: string[]
  detail: string
  check_type?: string
  fields?: ApiAdoptionFieldRow[]
  approved_on?: string | null
  window_ends_on?: string | null
  window_open?: boolean
  pending?: boolean
  is_conversion_adoption: boolean
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}

// --- Quarterly Deep-Dive Report (Step 9) ---------------------------------
//
// Mirrors app/schemas/i7/reports.py verbatim. `AvailabilityStatus` is the
// one recurring discipline across every section below: a metric that can be
// genuinely unavailable always carries an explicit status string alongside
// its value -- never a bare 0/false/null with no accompanying explanation.
// The frontend must render each status distinctly (see AvailabilityValue).

export type ApiGenerationStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"

export type ApiAvailabilityStatus =
  | "AVAILABLE"
  | "NOT_AVAILABLE"
  | "NOT_CONFIGURED"
  | "UNKNOWN"
  | "NOT_EVALUABLE"

export interface ApiQuarterlyReportListItem {
  report_id: number
  quarter: string
  status: ApiGenerationStatus
  report_version: string
  generated_at: string
  period_start: string
  period_end: string
}

export interface ApiQuarterlyReportListResponse {
  items: ApiQuarterlyReportListItem[]
  total: number
}

export interface ApiGenerationStatusResponse {
  quarter: string
  status: ApiGenerationStatus
  report_id: number | null
  generated_at: string | null
  error: string | null
}

export interface ApiReportMetadata {
  quarter: string
  period_start: string
  period_end: string
  generated_at: string
  report_version: string
  feature_run_id: number | null
  forecast_run_id: number | null
  inventory_run_id: number | null
  oar_run_id: number | null
}

export interface ApiExecutiveSummary {
  total_material_plants: number
  classified_percentage: ApiDecimal
  total_recommendations: number
  ready_for_review_count: number
  pending_approval_count: number
  pending_approval_percentage: ApiDecimal
  not_evaluable_count: number
  oar_count: number
  approval_ledger_entries: number
}

/** One mockup-facing KPI (stockout-risk severity, excess-inventory
 * candidates, working-capital impact, a stockout-risk trend) that has no
 * defined business rule or computation anywhere in I07 today -- confirmed by
 * a full backend source-tree audit, not merely unimplemented on this page.
 * `status` is always `NOT_CONFIGURED`; `reason` explains the gap factually
 * so a reader sees why, never a fabricated number standing in for it. */
export interface ApiUndefinedManagementMetric {
  status: ApiAvailabilityStatus
  reason: string
}

export interface ApiManagementSummary {
  critical_stockout_risk: ApiUndefinedManagementMetric
  excess_inventory_candidates: ApiUndefinedManagementMetric
  working_capital_impact: ApiUndefinedManagementMetric
  stockout_risk_distribution: ApiUndefinedManagementMetric
  stockout_risk_trend: ApiUndefinedManagementMetric
}

export interface ApiHistoryStatusCount {
  history_status: string
  count: number
}

export interface ApiScopeAndDataQuality {
  total_records: number
  classified_count: number
  classified_percentage: ApiDecimal
  unclassified_count: number
  unclassified_percentage: ApiDecimal
  history_status_breakdown: ApiHistoryStatusCount[]
  criticality_populated_count: number
  criticality_populated_percentage: ApiDecimal
  lead_time_populated_count: number
  lead_time_populated_percentage: ApiDecimal
}

export interface ApiDemandClassCount {
  demand_class: string
  count: number
  percentage: ApiDecimal
}

export interface ApiDemandClassification {
  total: number
  by_class: ApiDemandClassCount[]
}

export interface ApiForecastAccuracyMetric {
  status: ApiAvailabilityStatus
  value: ApiDecimal
  populated_count: number
  total_count: number
}

export interface ApiChampionChallengerCounts {
  champion_count: number
  challenger_count: number
  baseline_count: number
}

export interface ApiForecastingSection {
  total_forecasts: number
  mean_absolute_error: ApiForecastAccuracyMetric
  pinball_loss: ApiForecastAccuracyMetric
  bias_percentage: ApiForecastAccuracyMetric
  fill_rate: ApiForecastAccuracyMetric
  holding_cost: ApiForecastAccuracyMetric
  champion_challenger: ApiChampionChallengerCounts
  mape_status: ApiAvailabilityStatus
}

export interface ApiPopulationCount {
  populated_count: number
  missing_count: number
  total_count: number
  percentage_populated: ApiDecimal
}

export interface ApiSafetyStockSection {
  current: ApiPopulationCount
  recommended: ApiPopulationCount
  both_available_count: number
  mean_delta: ApiDecimal
  service_level_status: ApiAvailabilityStatus
}

export interface ApiReorderPointSection {
  current: ApiPopulationCount
  recommended: ApiPopulationCount
  both_available_count: number
  mean_delta: ApiDecimal
  /** Disclosure, not a computed metric: for SMOOTH/ERRATIC materials I07
   * reuses the current MARC value as-is rather than calculating a new one
   * (a 2026-09-22 product decision), so "Recommended" equals "Current" by
   * construction for that subset -- Mean Delta above is not independent
   * validation for those rows. */
  current_sap_value_reused_note: string
}

export interface ApiMaxStockSection {
  current: ApiPopulationCount
  recommended: ApiPopulationCount
  both_available_count: number
  mean_delta: ApiDecimal
  strategy_labeled_count: number
  strategy_production_resolved_count: number
  strategy_unresolved_fixture_count: number
  strategy_policy_status: ApiAvailabilityStatus
  /** Same disclosure as ApiReorderPointSection.current_sap_value_reused_note. */
  current_sap_value_reused_note: string
}

export interface ApiConversionEligibilityCount {
  conversion_eligibility: string | null
  count: number
}

export interface ApiOarSection {
  is_oar_true_count: number
  is_oar_false_count: number
  is_oar_null_count: number
  conversion_eligibility_breakdown: ApiConversionEligibilityCount[]
}

/** One ZMM065 tier's count -- the exact tier string verbatim (CRITICAL/
 * IMPACT/INSURANCE/NORMAL/OBSOLETE), never collapsed into an invented A/B/C
 * bucket (no such grouping exists in policy or code). `null` groups rows
 * where `criticality` itself is NULL -- the large majority on this extract. */
export interface ApiCriticalityTierCount {
  criticality: string | null
  count: number
}

/** Real distribution of `i7_recommendation.criticality` for rows generated
 * in this quarter -- the same quarter-scoped row set every other section in
 * this report reads, not the portfolio-wide (all-time) `/recommendations/
 * summary` distribution. */
export interface ApiMaterialCriticalitySection {
  total: number
  by_tier: ApiCriticalityTierCount[]
  populated_count: number
  populated_percentage: ApiDecimal
}

export interface ApiRecommendationStatusCount {
  status: string
  count: number
}

export interface ApiRecommendationsSection {
  total: number
  by_status: ApiRecommendationStatusCount[]
}

export interface ApiApprovalSection {
  ledger_entry_count: number
  distinct_recommendations_in_approval: number
  pending_count: number
  approved_count: number
  rejected_count: number
}

/** One row of Section 12 -- "Current/I11 Baseline vs I07 Recommendation".
 * Per the 2026-09-21 product correction, the baseline is I07's own
 * already-persisted current-state columns (current_safety_stock/current_rop/
 * current_max_stock) and MARC-PLIFZ lead time, standing in for I11 because no
 * separate I11 dataset or working I11LeadTimeProvider exists yet. Always
 * exactly 4 rows (Safety Stock, ROP, Max Stock, Lead Time), even when a row's
 * availability_status is NOT_AVAILABLE -- never dropped. */
export interface ApiBaselineComparisonRow {
  metric: string
  baseline_value: ApiDecimal
  recommendation_value: ApiDecimal
  delta: ApiDecimal
  delta_percentage: ApiDecimal
  both_available_count: number
  baseline_missing_count: number
  recommendation_missing_count: number
  not_evaluable_count: number
  availability_status: ApiAvailabilityStatus
  /** `true` only for the Lead Time row: baseline and I07-recommendation are
   * the SAME persisted column (MARC-PLIFZ), because I07 has no separately-
   * calculated lead time to compare against. A `true` row's delta/delta_
   * percentage are non-informative by construction -- agreement with itself,
   * not independent validation -- and must be disclosed as such. */
  self_referential: boolean
}

export interface ApiBaselineComparisonSection {
  baseline_lead_time_source: string
  i07_lead_time_source: string | null
  rows: ApiBaselineComparisonRow[]
}

export interface ApiSapAdoptionSection {
  status: ApiAvailabilityStatus
  reason: string
}

export interface ApiLimitationsSection {
  items: string[]
}

/** Why a calendar month of source data can or cannot be reported
 * (app/schemas/i7/reports.py::SourceMonthStatus). */
export type ApiSourceMonthStatus = "AVAILABLE" | "NO_ACTIVITY" | "NOT_COVERED" | "NO_SOURCE_DATA"

/** One calendar month of the report's period, read from the staged SAP consumption. The counts are
 * `null` -- never 0 -- unless the month is AVAILABLE or a confirmed NO_ACTIVITY (0). */
export interface ApiSourceActivityMonth {
  month: string
  status: ApiSourceMonthStatus
  material_plants_with_movements: number | null
  material_plants_with_demand: number | null
  materials_with_movements: number | null
  issue_transactions: number | null
  reversal_transactions: number | null
}

export interface ApiSourceActivityTotals {
  material_plants_with_movements: number
  material_plants_with_demand_in_any_month: number
  materials_with_movements: number
  issue_transactions: number
  reversal_transactions: number
  months_available: number
  months_no_activity: number
  months_not_covered: number
}

/** Consumption by the month it happened in, independent of when I07 generated its outputs
 * (report version 1.1). Absent on a report stored before then. */
export interface ApiSourceActivitySection {
  months: ApiSourceActivityMonth[]
  totals: ApiSourceActivityTotals
  staged_data_first_month: string | null
  staged_data_last_month: string | null
  quantity_status: ApiAvailabilityStatus
  quantity_note: string
  latest_recommendation_generated_at: string | null
  recommendations_generated_in_period: number
  output_note: string
}

// --- Quarter management view (report version 1.2) -------------------------------------------------
//
// Mirrors app/schemas/i7/reports.py::QuarterManagement. Everything on the management page -- the cards, the
// monthly activity table, the Overview's charts, the data coverage -- is read from here, so the page, the PDF
// and the Excel export show one set of figures. Decimals arrive as strings; `null` is "not available", never 0.

/** What kind of figure a number is. They are never mixed under one label. */
export type ApiMetricKind = "EVENT" | "STATUS_AS_OF" | "MEASUREMENT" | "AGGREGATE"

export interface ApiPeriodMonth {
  /** First day of the month, ISO. */
  month: string
  label: string
  state: "ended" | "in_progress" | "not_started"
  has_consumption_data: boolean
  usable: boolean
}

export interface ApiPeriodInfo {
  status: "COMPLETE" | "IN_PROGRESS"
  cutoff: string
  months: ApiPeriodMonth[]
  note: string
}

export interface ApiActivityRow {
  key: string
  label: string
  unit: string
  kind: ApiMetricKind
  /** One per month of the period. `null` = not available for that month (not started, not covered, not tracked). */
  months: (number | string | null)[]
  quarter_total: number | string | null
  status: ApiAvailabilityStatus
  /** Whether the months add up to the same figure counted over the whole period in one query. */
  reconciles: boolean | null
  note: string | null
}

export interface ApiMonthlyActivity {
  months: ApiPeriodMonth[]
  rows: ApiActivityRow[]
}

export interface ApiKpiCard {
  key: string
  title: string
  unit: string
  value: ApiDecimal
  status: ApiAvailabilityStatus
  explanation: string
  kind: ApiMetricKind
  measured_on: string | null
  period_label: string
  denominator: number | null
  denominator_label: string | null
  /** `current_calculation` (worked out when the report was generated) or `snapshot` (a saved month-end). */
  basis: string
  unavailable_reason: string | null
  note: string | null
}

export interface ApiStockoutPosition {
  at_risk: number
  evaluated: number
  insufficient_data: number
  as_of: string | null
  /** Built too long before the period to speak for it: kept for the record, not shown as the period's position. */
  stale: boolean
  stale_note: string | null
}

export interface ApiPositionFigures {
  population: number
  stockout: ApiStockoutPosition
  excess_count: number
  excess_opportunity: ApiDecimal
  net_rop_value_impact: ApiDecimal
  priced_count: number
  currency: string | null
}

export interface ApiPlantPosition {
  /** One SAP plant code; `null` is every plant. */
  plant: string | null
  figures: ApiPositionFigures
}

export interface ApiStatusCount {
  status: string
  count: number
  percentage: ApiDecimal
}

export interface ApiStatusDistribution {
  kind: ApiMetricKind
  basis: string
  measured_on: string
  total: number
  rows: ApiStatusCount[]
}

export interface ApiForecastActualMonth {
  month: string
  forecast: ApiDecimal
  actual: ApiDecimal
  material_count: number
}

export interface ApiForecastActualSection {
  status: ApiAvailabilityStatus
  months: ApiForecastActualMonth[]
  forecast_total: ApiDecimal
  actual_total: ApiDecimal
  accuracy: { observations: number; mean_absolute_error: ApiDecimal; bias_percentage: ApiDecimal } | null
  forecast_run_id: number | null
  note: string
}

export interface ApiAdoptionQuarter {
  status: ApiAvailabilityStatus
  confirmed_adoptions: number | null
  pending_approvals: number
  reason: string
  /** Recommendations with a change to adopt; the four counts below add up to it. Absent on an older backend. */
  tracked?: number | null
  adopted?: number | null
  partially_adopted?: number | null
  not_adopted?: number | null
  pending?: number | null
}

export interface ApiMonthCoverage {
  month: string
  label: string
  consumption_status: ApiSourceMonthStatus
  recommendations_generated: number
}

export interface ApiDataCoverage {
  latest_consumption_date: string | null
  latest_consumption_month: string | null
  latest_stock_loaded_at: string | null
  stockout_usage_as_of: string | null
  months: ApiMonthCoverage[]
  eligible_recommendations: number
  eligible_material_plants: number
  /** `current_calculation` or `snapshot`. */
  basis: string
  warnings: string[]
}

export interface ApiQuarterManagement {
  period: ApiPeriodInfo
  monthly_activity: ApiMonthlyActivity
  kpis: ApiKpiCard[]
  position: ApiPositionFigures
  plant_positions: ApiPlantPosition[]
  status_distribution: ApiStatusDistribution
  forecast_actual: ApiForecastActualSection
  adoption: ApiAdoptionQuarter
  data_coverage: ApiDataCoverage
  definitions: string[]
}

/** GET /v1/i7/reports/quarterly/{quarter} -- the full 14-section report body,
 * mirroring app/schemas/i7/reports.py::QuarterlyReport field-for-field. */
export interface ApiQuarterlyReport {
  metadata: ApiReportMetadata
  executive_summary: ApiExecutiveSummary
  management_summary: ApiManagementSummary
  scope_and_data_quality: ApiScopeAndDataQuality
  demand_classification: ApiDemandClassification
  forecasting: ApiForecastingSection
  safety_stock: ApiSafetyStockSection
  reorder_point: ApiReorderPointSection
  max_stock: ApiMaxStockSection
  material_criticality: ApiMaterialCriticalitySection
  oar: ApiOarSection
  recommendations: ApiRecommendationsSection
  approval: ApiApprovalSection
  baseline_comparison: ApiBaselineComparisonSection
  sap_adoption: ApiSapAdoptionSection
  limitations: ApiLimitationsSection
  /** Report version 1.1 and later; absent on an older stored report. */
  source_activity?: ApiSourceActivitySection | null
  /** Report version 1.2 and later; absent on an older stored report, which the page offers to regenerate. */
  management?: ApiQuarterManagement | null
}

/** GET /v1/i7/approval-events -- the approval ledger across every
 *  recommendation, newest first (app/api/i7/approval_events.py). */
export interface ApiApprovalEventsResponse {
  items: ApiApprovalHistoryEntry[]
  /** The whole filtered population, not the length of `items`. */
  total: number
  limit: number
  offset: number
}
