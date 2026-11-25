// Min-Max -> OAR recommendations: the wire types of /api/v1/i7/reverse-conversion/*.
//
// Hand-written to match app/schemas/i7/reverse_conversion.py in the backend (snake_case, exactly as sent).
// Decimals arrive as JSON strings (Pydantic), as everywhere else in I07; use parseDecimal() before arithmetic.
// Read-only: nothing here is stored, approved or written back to SAP.

/** The Recommendation dropdown's value for this view. The existing values are "oar" and "stock_item". */
export const MIN_MAX_TO_OAR_TYPE = "min_max_to_oar"

export type ReverseCategoryCode = "recommended_for_oar" | "not_eligible"

/** How sure the rule is that a Convert to OAR material should be ordered on requirement. Only those rows carry one. */
export type ReverseConfidenceCode = "high" | "medium" | "low"

/** Whether a material could move from Min-Max to OAR: "eligible" is Convert to OAR (whatever its confidence), and
 * "not_eligible" is Not Eligible. The same two verdicts the OAR table shows for Min-Max. */
export type ReverseEligibilityCode = "eligible" | "not_eligible"

export const REVERSE_ELIGIBILITY: readonly { code: ReverseEligibilityCode; label: string }[] = [
  { code: "eligible", label: "Eligible" },
  { code: "not_eligible", label: "Not eligible" },
]

/** The three confidence levels, most confident first. */
export const REVERSE_CONFIDENCES: readonly { code: ReverseConfidenceCode; label: string }[] = [
  { code: "high", label: "High" },
  { code: "medium", label: "Medium" },
  { code: "low", label: "Low" },
]

/** The three categories, in display order, with the words shown to a user on this screen. The first reads
 * "Convert to OAR" here; the API and the CSV keep the approved name "Recommended for OAR". There is no Manual
 * Review: a material a planner has to look at stays in Convert to OAR and carries a confidence. */
export const REVERSE_CATEGORIES: readonly { code: ReverseCategoryCode; label: string }[] = [
  { code: "recommended_for_oar", label: "Convert to OAR" },
  { code: "not_eligible", label: "Not Eligible" },
]

/** The reasons a Convert to OAR row can carry, in the words shown on screen (the same words as the API's labels).
 * The view lists only Convert to OAR rows, so the reasons of Not Eligible are not here. */
export const REVERSE_REASONS: readonly { code: string; label: string }[] = [
  { code: "sparse_recurring_demand", label: "Sparse recurring demand" },
  { code: "unknown_criticality", label: "Unknown criticality" },
  { code: "lead_time", label: "Lead time unknown or above 90 days" },
  { code: "lapsed", label: "Zero issues in latest 12 complete months but used previously" },
  { code: "borderline_frequency", label: "Borderline frequency" },
  { code: "stale_last_movement", label: "Stale last movement" },
  { code: "lifetime_criterion", label: "Lifetime criterion" },
  { code: "inconsistent_movement", label: "Inconsistent movement data" },
  { code: "never_moved", label: "Zero issues in 24 months and never moved" },
  { code: "zero_use_24m", label: "Zero issues in 24 months but moved before" },
  { code: "obsolete_criticality", label: "Obsolete" },
]

export const REVERSE_LEAD_TIME_BUCKETS: readonly { code: string; label: string }[] = [
  { code: "0-30d", label: "0-30 days" },
  { code: "31-60d", label: "31-60 days" },
  { code: "61-90d", label: "61-90 days" },
  { code: ">90d", label: "Over 90 days" },
  { code: "unknown", label: "Unknown" },
]

/** Criticality filter options: the five tiers the system knows, plus "unknown" (none recorded). */
export const REVERSE_CRITICALITY_OPTIONS: readonly { code: string; label: string }[] = [
  { code: "CRITICAL", label: "CRITICAL" },
  { code: "IMPACT", label: "IMPACT" },
  { code: "INSURANCE", label: "INSURANCE" },
  { code: "NORMAL", label: "NORMAL" },
  { code: "OBSOLETE", label: "OBSOLETE" },
  { code: "unknown", label: "Unknown" },
]

/** A Decimal as the backend sends it: a string, a number, or nothing. */
export type ApiDecimalValue = string | number | null

export interface ApiReverseAnchor {
  /** The latest complete month every consumption window is measured to, YYYY-MM. */
  month: string
  /** "configured" (pinned) or "data_load_timestamp" (derived from when the data was loaded). */
  source: string
  latest_staged_month: string | null
  data_loaded_at: string | null
  warnings: string[]
}

export interface ApiReversePolicy {
  version: string
  /** Every applied threshold, as the policy holds it (see ReverseConversionPolicy.parameters()). */
  parameters: Record<string, unknown>
}

export interface ApiReverseCategoryTotals {
  category: ReverseCategoryCode
  label: string
  count: number
  with_stock: number
  with_stock_missing_price: number
  stock_value: ApiDecimalValue
  currency: string | null
}

export interface ApiReversePlantCategoryCount {
  plant: string
  category: ReverseCategoryCode
  count: number
}

export interface ApiReverseConfidenceCount {
  confidence: ReverseConfidenceCode
  label: string
  count: number
}

export interface ApiReverseReasonCount {
  category: ReverseCategoryCode
  reason: string
  reason_label: string
  count: number
}

export interface ApiReverseSummary {
  by_category: ApiReverseCategoryTotals[]
  by_plant_category: ApiReversePlantCategoryCount[]
  by_reason: ApiReverseReasonCount[]
  /** Convert to OAR rows by confidence: High, Medium, Low. */
  by_confidence: ApiReverseConfidenceCount[]
}

export interface ApiReverseReconciliation {
  source_population: number
  excluded: number
  categorised: number
  duplicate_keys: number
  reconciled: boolean
  by_plant: { plant: string; source_population: number; categorised: number }[]
}

export interface ApiReverseRecommendation {
  material: string
  description: string | null
  plant: string
  mrp_type: string | null
  criticality: string | null
  category: ReverseCategoryCode
  category_label: string
  /** Whether the material could move from Min-Max to OAR. */
  conversion_eligibility: ReverseEligibilityCode
  reason: string
  reason_label: string
  /** High / Medium / Low for a Convert to OAR row; null for every other category. */
  confidence: ReverseConfidenceCode | null
  confidence_label: string | null
  explanation: string
  decision_rule: number

  issues_latest_12m: number
  months_with_consumption_12m: number
  issues_prior_12m: number
  first_valid_movement: string | null
  last_valid_movement: string | null
  months_since_last_movement: number | null
  history_span_months: number | null
  lifetime_months_with_use: number

  lead_time_days: ApiDecimalValue
  lead_time_bucket: string
  current_stock: ApiDecimalValue
  minbe: ApiDecimalValue
  mabst: ApiDecimalValue
  unit_price: ApiDecimalValue
  stock_value: ApiDecimalValue
  currency: string | null
}

/** One month of a material-plant's consumption (GET .../recommendations/{material}/{plant}/consumption). */
export interface ApiReverseConsumptionMonth {
  /** YYYY-MM. */
  month: string
  net_issued_quantity: ApiDecimalValue
  issue_count: number
  reversal_count: number
}

export interface ApiReverseConsumption {
  material: string
  plant: string
  anchor_month: string
  /** First month of the latest 12-month window the rule counts; earlier months are the window before it. */
  latest_window_start: string
  months: ApiReverseConsumptionMonth[]
}

export interface ApiReverseRecommendationsResponse {
  anchor: ApiReverseAnchor
  policy: ApiReversePolicy
  summary: ApiReverseSummary
  reconciliation: ApiReverseReconciliation
  items: ApiReverseRecommendation[]
  /** Rows matching the filters, before paging. */
  total: number
  page: number
  page_size: number
}
