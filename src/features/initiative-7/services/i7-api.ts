// Part 21 — I07 frontend/backend integration.
//
// The ONLY place I07 talks to the real FastAPI backend. Every function here
// is a thin wrapper over `apiFetch` (src/lib/api/client.ts) plus a mapper
// into the existing `Recommendation`/approval types the UI already renders --
// no business value is computed here, only reshaped for display. See
// docs/i07_api.md (backend) for the authoritative contract these mirror.
//
// Mounted at API_BASE_URL + "/v1/i7" (see app/api/i7/router.py's
// `prefix="/v1/i7"`, itself mounted under settings.api_prefix in app/main.py)
// -- NOT directly under API_BASE_URL, which is why every path below is
// prefixed with I7_BASE rather than reusing apiFetch's bare paths the way
// getHealth() does.

import { apiFetch, ApiError, API_BASE_URL } from "@/lib/api/client"
import type { MaterialReference } from "@/lib/domain/contracts"
import type { RiskLevel } from "@/components/shared/risk-badge"
import type {
  ApiAdoptionListItem,
  ApiForecastVsActualResponse,
  ApiAdoptionListResponse,
  ApiAdoptionResponse,
  ApiAdoptionSummary,
  ApiApprovalAction,
  ApiApprovalEventsResponse,
  ApiApprovalHistoryResponse,
  ApiApprovalRole,
  ApiDecimal,
  ApiForecastHistoryResponse,
  ApiSimilarMaterialsChangeResponse,
  ApiSimilarMaterialsResponse,
  ApiGenerationStatusResponse,
  ApiQuarterlyReport,
  ApiQuarterlyReportListResponse,
  ApiRecommendationDetail,
  ApiRecommendationListResponse,
  ApiRecommendationSummary,
  ApiRecommendationSummaryStats,
  ApiRecommendationTrace,
  ApiWorkflowStateResponse,
} from "@/features/initiative-7/types/api"
import type {
  Circuit,
  Criticality,
  DemandPattern,
  OarConversionInfo,
  Recommendation,
  RecommendationFactor,
  RecommendationStatus,
  RecommendationType,
} from "@/features/initiative-7/types/inventory"

const I7_BASE = "/v1/i7"

export { ApiError }

/** Pydantic serializes `Decimal` as a JSON string ("0.000000"), not a number
 * -- confirmed against the live API. Every ApiDecimal field passes through
 * this before use; `null`/undefined/an unparsable string all become `null`
 * rather than 0, so a genuinely-absent value is never displayed as zero. */
function toNumber(value: ApiDecimal): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** "2025-08-01" -> "Aug", matching the short month-name axis labels the
 * existing scenario/mock consumption fixtures already use (see
 * data/recommendations.ts). Parses the date parts directly rather than via
 * `new Date(string)` to avoid a timezone-dependent off-by-one on the day. */
function formatConsumptionPeriod(period: string): string {
  const month = Number(period.slice(5, 7))
  return MONTH_ABBREVIATIONS[month - 1] ?? period
}

// --- Status/enum mapping -------------------------------------------------
//
// The backend's LifecycleStatus (READY_FOR_REVIEW, NOT_EVALUABLE, PENDING_
// APPROVAL, APPROVED, REJECTED, SENT_BACK, HELD, ADJUSTED,
// SAP_EXECUTION_PENDING, SAP_EXECUTED, ADOPTED, PARTIALLY_ADOPTED,
// NOT_ADOPTED -- see app/initiatives/i7/recommendations/types.py) is a
// materially richer state machine than the existing frontend
// RecommendationStatus (a 6-value scenario-authored enum). This map is a
// DISPLAY reduction only -- it never feeds back into any decision the
// backend makes -- and prefers the closest visible label over collapsing
// distinct backend states into one where a table column already has room
// (see the extra branches added to STATUS_TONE/STATUS_LABEL callers).
const STATUS_MAP: Record<string, RecommendationStatus> = {
  NOT_EVALUABLE: "Pending Review",
  READY_FOR_REVIEW: "Pending Review",
  PENDING_APPROVAL: "In Approval",
  HELD: "In Approval",
  SENT_BACK: "Returned",
  ADJUSTED: "In Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SAP_EXECUTION_PENDING: "Approved",
  SAP_EXECUTED: "Implemented",
  ADOPTED: "Implemented",
  PARTIALLY_ADOPTED: "Implemented",
  NOT_ADOPTED: "Implemented",
}

/** The raw backend status string, alongside its display reduction -- callers
 * that need the real value (e.g. to decide whether HOLD/RELEASE_HOLD apply)
 * read `rawStatus`, never re-derive it from the display label. */
export function mapStatus(raw: string): RecommendationStatus {
  return STATUS_MAP[raw] ?? "Pending Review"
}

/** The backend's real criticality vocabulary is the five ZMM065 tiers --
 * CRITICAL, IMPACT, INSURANCE, NORMAL, OBSOLETE -- a nominal SAP
 * classification the backend's own app/core/criticality.py explicitly
 * documents as NOT an ordinal 1..5 ("OBSOLETE is not 'more critical' than
 * NORMAL, it is a different kind of statement"). The frontend's Criticality
 * type (Low/Medium/High/Critical) is a shared, ordinal display scale used by
 * components across the app, so this maps the backend's own explicitly
 * stated SEVERITY_ORDER (CRITICAL > IMPACT > INSURANCE > NORMAL > OBSOLETE)
 * onto it -- the backend's own ranking, not one invented here. */
const CRITICALITY_MAP: Record<string, Criticality> = {
  CRITICAL: "Critical",
  IMPACT: "High",
  INSURANCE: "Medium",
  NORMAL: "Low",
  OBSOLETE: "Low",
}

/** `Recommendation.criticality` is a non-optional field shared with the
 * scenario/generated fixtures, so this cannot return `null` without widening
 * that type across every mock-mode component that indexes
 * `Record<Criticality, ...>` today. A missing/unrecognised tier -- the
 * actual state for 2,011,482 of this extract's 2,042,370 rows -- falls back
 * to "Low" (never "Medium": unlike the old mapping, this never invents a
 * mid-severity classification for a material with NO recorded severity at
 * all). The genuinely-unknown case is instead surfaced honestly through
 * `risk` (see `deriveRisk`, which reads the RAW backend string separately
 * and only escalates risk when a real tier was actually recorded) and
 * through `CriticalityInfo.value` on the detail response, which the UI can
 * still read directly where it needs the true value rather than this
 * display reduction. */
function mapCriticality(raw: string | null): Criticality {
  if (!raw) return "Low"
  return CRITICALITY_MAP[raw.toUpperCase()] ?? "Low"
}

const DEMAND_MAP: Record<string, DemandPattern> = {
  SMOOTH: "Smooth",
  ERRATIC: "Erratic",
  LUMPY: "Lumpy",
  INTERMITTENT: "Intermittent",
  SLOW: "Slow-Moving",
  // Under the backend's history gate: nothing to classify, so OAR similarity
  // sizes it. Not "Intermittent" -- that is a claim about demand it never made.
  UNCLASSIFIED: "Cold start",
}

/** The backend's OAR / DECLINING / NORMAL as the display words. An absent value
 * (an older backend) reads as Normal, which is what it was before the split. */
export function mapDemandType(raw: string | undefined): RecommendationType {
  if (raw === "OAR") return "OAR"
  if (raw === "DECLINING") return "Declining"
  return "Normal"
}

function mapDemandPattern(raw: string | null): DemandPattern {
  if (!raw) return "Unclassified"
  return DEMAND_MAP[raw.toUpperCase()] ?? "Unclassified"
}

/** A circuit the frontend's Circuit union recognises, or "Unassigned" --
 * MARC carries no circuit for most of this extract (see
 * app/schemas/i7/recommendations.py's circuit docstring), which is a real
 * data gap, not a mapping bug. */
function mapCircuit(raw: string | null): Circuit {
  const known: Circuit[] = ["Crushing", "Milling", "Pumping", "Filtration", "Conveying", "Flotation"]
  if (raw && (known as string[]).includes(raw)) return raw as Circuit
  return "Unassigned"
}

/** Risk is a UI-only display label with no backend equivalent (there is no
 * "stockout risk" concept in the I07 domain -- see
 * app/schemas/i7/recommendations.py's ImpactInfo docstring, which explicitly
 * states no risk model exists). Derived from the RAW criticality string (not
 * the already-defaulted `Criticality` value) so a genuinely missing
 * criticality -- the actual state for the vast majority of this extract's
 * material-plants -- renders as "low" rather than fabricating a MEDIUM
 * badge, which would misrepresent a data gap as a real assessment. Never
 * read back into any decision.
 *
 * Part 36 fix: this used to compare the raw tier against the literal strings
 * "HIGH"/"MEDIUM", which never occur -- the real ZMM065 vocabulary is
 * CRITICAL/IMPACT/INSURANCE/NORMAL/OBSOLETE (see CRITICALITY_MAP above,
 * which already maps IMPACT->High and INSURANCE->Medium correctly). That
 * meant no material could ever show "high"/"medium" stockout risk, only
 * "critical" or "low", silently under-escalating every IMPACT/INSURANCE
 * material this whole time. Reuses CRITICALITY_MAP directly so the two
 * mappings can never drift apart again. */
function deriveRisk(rawCriticality: string | null, status: RecommendationStatus): RiskLevel {
  const open = status === "Pending Review" || status === "In Approval" || status === "Returned"
  if (!open || !rawCriticality) return "low"
  const mapped = CRITICALITY_MAP[rawCriticality.toUpperCase()]
  // CRITICAL and IMPACT are one tier on every live page: "high". The backend still tells the two
  // apart (its by_risk, and risk=critical), and the quarterly reports keep their four tiers.
  if (mapped === "Critical" || mapped === "High") return "high"
  if (mapped === "Medium") return "medium"
  return "low"
}

/** Mirrors WorkflowState.pending_role exactly (app/initiatives/i7/
 * recommendations/workflow.py) -- chain_index is only meaningful while the
 * raw backend status is PENDING_APPROVAL/SENT_BACK/HELD, so this reads the
 * RAW status (not the display-reduced RecommendationStatus, which collapses
 * all three into "In Approval"/"Returned" and would lose the distinction the
 * rule actually needs). Never recomputes the route itself -- `route` is
 * read verbatim from the list endpoint, which already resolved it through
 * the live ApprovalRoutingPolicy. */
function derivePendingRole(rawStatus: string, chainIndex: number, route: string[]): string | null {
  if (!["PENDING_APPROVAL", "SENT_BACK", "HELD"].includes(rawStatus)) return null
  if (chainIndex >= route.length) return null
  return route[chainIndex] ?? null
}

function materialRefFor(materialNumber: string, description?: string | null): MaterialReference {
  // Live recommendations use the real SAP material number as both id and
  // code -- there is no app-side catalog entry to join against (see
  // lib/sap/dataset-mode.ts's identity-gap note).
  //
  // The description IS available: the backend joins it from MAKT through
  // i7_staged_material. It falls back to the material number rather than to an
  // empty string because `description` is required on MaterialReference (a
  // frozen contract) and several screens render `${materialId} — ${description}`
  // -- an empty value there renders a dangling em-dash, and the search haystacks
  // on the Recommendations, Overview and Pipeline tables concatenate it, where
  // an empty string would silently match every query.
  return {
    materialId: materialNumber,
    materialCode: materialNumber,
    description: description ?? materialNumber,
  }
}

/** Maps one list-endpoint row into the existing Recommendation shape, for
 * the parts the table already renders. `current`/`recommended`/`impact` are
 * real values straight from the list endpoint (see ApiRecommendationSummary)
 * -- not fetched separately and not fabricated. Fields the summary endpoint
 * still does not carry (lead time, demand rate, rationale, etc.) remain
 * zeroed/empty; callers needing those must fetch the detail. */
export function mapSummaryToRecommendation(row: ApiRecommendationSummary): Recommendation {
  const status = mapStatus(row.status)
  const criticality = mapCriticality(row.criticality)
  // The list endpoint carries no blocking_reason (only the detail endpoint
  // does), but it does carry the raw backend status -- which is enough on
  // its own to know a NOT_EVALUABLE row has no real stock parameters to
  // compare, so the table (see isNotYetComputed in
  // recommendation-review-table.tsx) does not read a fabricated 0/0 "no
  // change" as if it were a genuine equal-value comparison.
  const factors =
    row.status === "NOT_EVALUABLE" ? [{ label: "Blocked", detail: "Not yet evaluated by the backend." }] : []
  return {
    id: row.recommendation_id,
    material: materialRefFor(row.material, row.description),
    plantId: row.plant,
    circuit: "Unassigned",
    criticality,
    criticalityTier: row.criticality ? row.criticality.toUpperCase() : null,
    demandPattern: mapDemandPattern(row.demand_class),
    demandType: mapDemandType(row.demand_type),
    conversionEligibility: (row.conversion_eligibility as OarConversionInfo["conversionEligibility"]) ?? null,
    risk: deriveRisk(row.criticality, status),
    status,
    current: {
      rop: toNumber(row.current.rop) ?? 0,
      safetyStock: toNumber(row.current.safety_stock) ?? 0,
      maxStock: toNumber(row.current.max_stock) ?? 0,
    },
    recommended: {
      rop: toNumber(row.recommended.rop) ?? 0,
      safetyStock: toNumber(row.recommended.safety_stock) ?? 0,
      maxStock: toNumber(row.recommended.max_stock) ?? 0,
    },
    avgDailyConsumption: 0,
    leadTimeDays: 0,
    leadTimeVarianceDays: 0,
    serviceLevelTarget: 0,
    // The list endpoint carries none of these; the detail mapper fills them in.
    unavailable: ["leadTime", "serviceLevel", "consumption"],
    unitPrice: toNumber(row.unit_price) ?? 0,
    currency: row.currency ?? null,
    annualConsumption: 0,
    // Same formula as the detail mapper's own workingCapitalImpact -- unit_price
    // is now carried on the list endpoint too (Part 34), so this no longer has
    // to wait for a row to be expanded.
    workingCapitalImpact:
      row.impact.status === "AVAILABLE"
        ? -(toNumber(row.impact.safety_stock_delta) ?? 0) * (toNumber(row.unit_price) ?? 0)
        : 0,
    consumptionHistory: [],
    factors,
    championChallenger: {
      champion: { name: row.demand_class ?? "—", description: "", accuracyPct: 0 },
      challenger: { name: "—", description: "", accuracyPct: 0 },
      selected: "champion",
      rationale: "",
    },
    workflow: [],
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    pendingRole: derivePendingRole(row.status, row.chain_index, row.route),
    chainIndex: row.chain_index,
    routeLength: row.route.length,
  }
}

/** Maps a full detail response into the existing Recommendation shape. This
 * is the one place a live recommendation's stock/demand/rationale fields are
 * populated -- every value is read from `detail` as-is (see
 * app/schemas/i7/recommendations.py's own "nothing here is invented"
 * guarantee), never recalculated. */
export function mapDetailToRecommendation(detail: ApiRecommendationDetail): Recommendation {
  const status = mapStatus(detail.status)
  // Actual usage over the latest 12 months of the series the chart draws (complete, oldest
  // first, zero months included). Not forecast x 12: an OAR material has no forecast, and its
  // real usage is still known.
  const history = detail.demand.consumption_history
  const lastTwelveMonthsUsage = history.slice(-12).reduce((sum, point) => sum + (toNumber(point.quantity) ?? 0), 0)
  const criticality = mapCriticality(detail.criticality.value)
  const factors: RecommendationFactor[] = detail.blocking_reason
    ? [{ label: "Blocked", detail: detail.blocking_reason }]
    : []

  return {
    id: detail.recommendation_id,
    material: materialRefFor(detail.material, detail.description),
    plantId: detail.plant,
    circuit: mapCircuit(detail.circuit),
    criticality,
    criticalityTier: detail.criticality.value ? detail.criticality.value.toUpperCase() : null,
    demandPattern: mapDemandPattern(detail.demand.demand_class),
    risk: deriveRisk(detail.criticality.value, status),
    status,
    current: {
      rop: toNumber(detail.current.rop) ?? 0,
      safetyStock: toNumber(detail.current.safety_stock) ?? 0,
      maxStock: toNumber(detail.current.max_stock) ?? 0,
    },
    recommended: {
      rop: toNumber(detail.recommended.rop) ?? 0,
      safetyStock: toNumber(detail.recommended.safety_stock) ?? 0,
      maxStock: toNumber(detail.recommended.max_stock) ?? 0,
    },
    avgDailyConsumption: toNumber(detail.demand.forecast_rate) ?? 0,
    leadTimeDays: toNumber(detail.lead_time.days) ?? 0,
    leadTimeVarianceDays: toNumber(detail.lead_time.variance_days) ?? 0,
    serviceLevelTarget: toNumber(detail.service_level.service_level) ?? 0,
    zFactor: toNumber(detail.service_level.z_factor),
    unavailable: [
      ...(toNumber(detail.lead_time.days) == null ? (["leadTime"] as const) : []),
      ...(toNumber(detail.service_level.service_level) == null ? (["serviceLevel"] as const) : []),
      ...(history.length === 0 ? (["consumption"] as const) : []),
    ],
    unitPrice: toNumber(detail.unit_price) ?? 0,
    currency: detail.currency ?? null,
    annualConsumption: lastTwelveMonthsUsage,
    workingCapitalImpact:
      detail.impact.status === "AVAILABLE"
        ? -(toNumber(detail.impact.safety_stock_delta) ?? 0) * (toNumber(detail.unit_price) ?? 0)
        : 0,
    consumptionHistory: detail.demand.consumption_history.map((point) => ({
      period: formatConsumptionPeriod(point.period),
      qty: toNumber(point.quantity) ?? 0,
    })),
    factors,
    championChallenger: {
      champion: {
        name: detail.demand.model ?? "—",
        description: detail.demand.history_status ?? "",
        accuracyPct: 0,
      },
      challenger: { name: "—", description: "", accuracyPct: 0 },
      selected: "champion",
      rationale: "",
    },
    workflow: [],
    oarColdStart: detail.oar.is_oar
      ? {
          similarMaterials: [],
          suggestedRop: toNumber(detail.recommended.rop) ?? 0,
          suggestedSafetyStock: toNumber(detail.recommended.safety_stock) ?? 0,
          confidence:
            detail.oar.confidence === "HIGH" ? "High" : detail.oar.confidence === "LOW" ? "Low" : "Medium",
          factors: detail.oar.conversion_detail ? [detail.oar.conversion_detail] : [],
          note: `Similarity: ${detail.oar.similarity_status ?? "unknown"} · Estimate: ${detail.oar.estimate_status ?? "unknown"}`,
        }
      : undefined,
    // FRS SOP 3.1.1 -- shown whenever the backend made a conversion decision,
    // on either path: an OAR (ND/PD/blank) material can be cold-start or have
    // enough history for a normal forecast, and the backend evaluates both. A
    // material it did not evaluate (not OAR, or an older row) has no decision,
    // and inventing a section for it would be a fabricated "not eligible".
    oarConversion: detail.oar.conversion_eligibility
      ? {
          isOar: detail.oar.is_oar,
          conversionEligibility:
            (detail.oar.conversion_eligibility as OarConversionInfo["conversionEligibility"]) ?? null,
          conversionTrigger: (detail.oar.conversion_trigger as OarConversionInfo["conversionTrigger"]) ?? null,
          conversionDetail: detail.oar.conversion_detail,
          demandClass: detail.oar.demand_class,
          consumptionCount12m: detail.oar.consumption_count_12m,
          consumptionCountThreshold: detail.oar.consumption_count_threshold,
          productionImpact: detail.oar.production_impact,
          i13HodApproved: detail.oar.i13_hod_approved,
        }
      : undefined,
    generatedAt: detail.generated_at,
    updatedAt: detail.updated_at,
    rationale: { text: detail.rationale.text, source: detail.rationale.source },
  }
}

// --- Recommendations ------------------------------------------------------

export interface RecommendationListParams {
  page?: number
  pageSize?: number
  sort?: string
  sortDesc?: boolean
  status?: string
  plant?: string
  material?: string
  demandClass?: string
  isOar?: boolean
  /** oar | declining | normal | stock_item -- the Type filter, applied in SQL. stock_item is
   * declining and normal together (everything that is not OAR). */
  type?: "oar" | "declining" | "normal" | "stock_item"
  confidence?: string
  /** ELIGIBLE | NOT_ELIGIBLE -- the OAR -> Min-Max conversion decision, applied in SQL. */
  conversionEligibility?: string
  /** Only recommendations issued more than the policy threshold in the last 12 months -- drops
   * zero-consumption materials too. Applied in SQL. */
  consumptionAboveThreshold?: boolean
  /** Only recommendations with something to adopt in SAP: an OAR one eligible for the Min-Max
   * conversion, or a stock item whose reorder point, safety stock or max stock differs from SAP's
   * current value. The set the SAP adoption counts cover. Applied in SQL. */
  actionable?: boolean
  criticality?: string
  /** Part of a material number or description, searched across the whole catalogue. */
  search?: string
  /** Critical | High | Medium | Low -- the level the table shows, not the raw tier. */
  criticalityLevel?: string
  /** The status as the table shows it (Pending Review, In Approval, ...). */
  statusGroup?: string
  /** critical | high | medium | low -- the stockout risk the table shows. */
  risk?: string
  /** Inclusive lower bound on generated_at, ISO 8601 -- e.g. a report
   * period's start, so a material table can be scoped to the same quarter
   * the report itself was generated for. */
  generatedFrom?: string
  /** Exclusive upper bound on generated_at, ISO 8601. */
  generatedTo?: string
}

export interface RecommendationListResult {
  recommendations: Recommendation[]
  total: number
  page: number
  pageSize: number
}

function toQueryString(params: RecommendationListParams): string {
  const search = new URLSearchParams()
  if (params.page) search.set("page", String(params.page))
  if (params.pageSize) search.set("page_size", String(params.pageSize))
  if (params.sort) search.set("sort", params.sort)
  if (params.sortDesc !== undefined) search.set("sort_desc", String(params.sortDesc))
  if (params.status) search.set("status", params.status)
  if (params.plant) search.set("plant", params.plant)
  if (params.material) search.set("material", params.material)
  if (params.demandClass) search.set("demand_class", params.demandClass)
  if (params.isOar !== undefined) search.set("is_oar", String(params.isOar))
  if (params.type) search.set("type", params.type)
  if (params.confidence) search.set("confidence", params.confidence)
  if (params.conversionEligibility) search.set("conversion_eligibility", params.conversionEligibility)
  if (params.consumptionAboveThreshold) search.set("consumption_above_threshold", "true")
  if (params.actionable) search.set("actionable", "true")
  if (params.criticality) search.set("criticality", params.criticality)
  if (params.search) search.set("search", params.search)
  if (params.criticalityLevel) search.set("criticality_level", params.criticalityLevel)
  if (params.statusGroup) search.set("status_group", params.statusGroup)
  if (params.risk) search.set("risk", params.risk)
  if (params.generatedFrom) search.set("generated_from", params.generatedFrom)
  if (params.generatedTo) search.set("generated_to", params.generatedTo)
  const query = search.toString()
  return query ? `?${query}` : ""
}

/** GET /api/v1/i7/recommendations, mapped to the existing Recommendation[]
 * shape the table already renders. Filtering/sorting/pagination all happen
 * in the backend's SQL (see app/api/i7/recommendations.py) -- params here
 * are passed straight through as query string, never re-filtered client
 * side. */
export async function fetchRecommendations(
  params: RecommendationListParams = {},
): Promise<RecommendationListResult> {
  const response = await apiFetch<ApiRecommendationListResponse>(
    `${I7_BASE}/recommendations${toQueryString(params)}`,
  )
  return {
    recommendations: response.items.map(mapSummaryToRecommendation),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  }
}

export interface RecommendationSummaryStats {
  total: number
  byStatus: { status: string; count: number }[]
  byCriticality: { criticality: string | null; count: number }[]
  byCircuit: { circuit: string | null; count: number }[]
  byRisk: { risk: string; count: number }[]
  byPlant: { plant: string; count: number }[]
  oarCount: number
  normalCount: number
  awaitingApprovalCount: number
  readyForReviewCount: number
  notEvaluableCount: number
  /** Currency of the money figures, when every priced material shares one. */
  currency: string | null
  netSafetyStockValueImpact: number | null
  /** Net working-capital impact of the recommended reorder points (unit price x current - recommended
   * ROP): positive releases, negative ties up. null when no row has all three; never 0. */
  netRopValueImpact: number | null
  /** High Stockout Risk: Fast / Slow material-plants whose stock on hand is below average daily
   * consumption x lead time. */
  criticalStockoutRiskCount: number
  /** Material-plants that could be judged -- the denominator for the share at risk. */
  stockoutRiskEvaluatedCount: number
  /** Fast / Slow material-plants with no lead time or stock on hand: Insufficient Data. */
  stockoutRiskInsufficientDataCount: number
  /** ISO date the consumption and Fast / Slow bands were read as of; null = not computed yet. */
  stockoutRiskAsOf: string | null
  excessInventoryCandidatesCount: number
  excessInventoryOpportunity: number | null
}

/** GET /api/v1/i7/recommendations/summary -- portfolio-wide counts/sums for
 * dashboards and KPI cards. Accepts the same filter params as the list
 * endpoint (a subset of RecommendationListParams; page/pageSize/sort do not
 * apply here and are ignored if passed). */
export async function fetchRecommendationSummary(
  params: Omit<RecommendationListParams, "page" | "pageSize" | "sort"> = {},
): Promise<RecommendationSummaryStats> {
  const response = await apiFetch<ApiRecommendationSummaryStats>(
    `${I7_BASE}/recommendations/summary${toQueryString(params)}`,
  )
  return {
    total: response.total,
    byStatus: response.by_status.map((row) => ({ status: row.status, count: row.count })),
    byCriticality: response.by_criticality.map((row) => ({
      criticality: row.criticality,
      count: row.count,
    })),
    byCircuit: response.by_circuit.map((row) => ({ circuit: row.circuit, count: row.count })),
    byRisk: response.by_risk.map((row) => ({ risk: row.risk, count: row.count })),
    byPlant: response.by_plant.map((row) => ({ plant: row.plant, count: row.count })),
    oarCount: response.oar_count,
    normalCount: response.normal_count,
    awaitingApprovalCount: response.awaiting_approval_count,
    readyForReviewCount: response.ready_for_review_count,
    notEvaluableCount: response.not_evaluable_count,
    currency: response.currency ?? null,
    netSafetyStockValueImpact: toNumber(response.net_safety_stock_value_impact),
    netRopValueImpact: toNumber(response.net_rop_value_impact ?? null),
    criticalStockoutRiskCount: response.critical_stockout_risk_count,
    stockoutRiskEvaluatedCount: response.stockout_risk_evaluated_count ?? 0,
    stockoutRiskInsufficientDataCount: response.stockout_risk_insufficient_data_count ?? 0,
    stockoutRiskAsOf: response.stockout_risk_as_of ?? null,
    excessInventoryCandidatesCount: response.excess_inventory_candidates_count,
    excessInventoryOpportunity: toNumber(response.excess_inventory_opportunity),
  }
}

/** GET /api/v1/i7/recommendations/{id}, mapped to the existing Recommendation
 * shape. Returns null on a 404 (recommendation not found / superseded)
 * rather than throwing, matching getRecommendationById's existing
 * `| undefined` contract so callers do not need two different not-found
 * idioms. */
export async function fetchRecommendationDetail(id: string): Promise<Recommendation | null> {
  try {
    const detail = await apiFetch<ApiRecommendationDetail>(
      `${I7_BASE}/recommendations/${encodeURIComponent(id)}`,
    )
    return mapDetailToRecommendation(detail)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function fetchRecommendationTrace(id: string): Promise<ApiRecommendationTrace> {
  return apiFetch<ApiRecommendationTrace>(`${I7_BASE}/recommendations/${encodeURIComponent(id)}/trace`)
}

export interface ForecastHistoryPoint {
  period: string
  predicted: number | null
  actual: number | null
}

export interface ForecastHistory {
  modelName: string | null
  points: ForecastHistoryPoint[]
}

/** GET /recommendations/{id}/forecast-history -- real champion-model
 * predicted/actual pairs, never a client-side recompute. `points` is `[]`
 * (never fabricated) when nothing is persisted yet for this material-plant. */
export async function fetchForecastHistory(id: string): Promise<ForecastHistory> {
  const response = await apiFetch<ApiForecastHistoryResponse>(
    `${I7_BASE}/recommendations/${encodeURIComponent(id)}/forecast-history`,
  )
  return {
    modelName: response.model_name,
    points: response.points.map((p) => ({
      period: p.forecast_period,
      predicted: toNumber(p.predicted),
      actual: toNumber(p.actual),
    })),
  }
}

export interface SimilarMaterial {
  rank: number
  material: string
  plant: string
  description: string | null
  /** 0..1 combined similarity, or null when the engine stored none. */
  similarity: number | null
  /** The neighbour's own ZMM065 tier, upper-cased, or null. */
  criticality: string | null
  historyMonths: number | null
  /** What SAP holds for the neighbour now (MARC reorder point, safety stock, max stock);
   * null when SAP has no value -- shown as "—", never as 0. */
  rop: number | null
  safetyStock: number | null
  maxStock: number | null
  /** Whether its stock values fed the weighted estimate. */
  contributed: boolean
}

/** A similar material a user removed for this material -- eligible and ranked, then set aside by a person.
 * Not one that failed the similarity rules: those are never listed. */
export interface ExcludedSimilarMaterial {
  material: string
  plant: string
  description: string | null
  /** 0..1 score it had when removed, or null. */
  similarity: number | null
  rank: number | null
  reason: string | null
  /** The identity the request carried -- see `isPlaceholderActor` before presenting it as a person. */
  excludedBy: string
  excludedAt: string | null
}

/** The similar-materials card's whole state for one recommendation. */
export interface SimilarMaterialsView {
  items: SimilarMaterial[]
  excluded: ExcludedSimilarMaterial[]
  /** Whether removing or restoring is possible now. `null` from a backend that predates it: the
   * card then offers no controls rather than guessing. */
  canEdit: boolean | null
  editBlockedReason: string | null
  /** How many similar materials the estimate needs. */
  minimumNeighbours: number | null
}

function mapSimilarMaterialsView(response: ApiSimilarMaterialsResponse): SimilarMaterialsView {
  return {
    items: response.neighbours.map((n) => ({
      rank: n.rank,
      material: n.material,
      plant: n.plant,
      description: n.description,
      similarity: toNumber(n.similarity),
      criticality: n.criticality ? n.criticality.toUpperCase() : null,
      historyMonths: n.history_months,
      safetyStock: toNumber(n.current_safety_stock ?? null),
      rop: toNumber(n.current_rop ?? null),
      maxStock: toNumber(n.current_max_stock ?? null),
      contributed: n.contributed,
    })),
    excluded: (response.excluded ?? []).map((e) => ({
      material: e.material,
      plant: e.plant,
      description: e.description,
      similarity: toNumber(e.similarity),
      rank: e.rank,
      reason: e.reason,
      excludedBy: e.excluded_by,
      excludedAt: e.excluded_at,
    })),
    canEdit: response.can_edit ?? null,
    editBlockedReason: response.edit_blocked_reason ?? null,
    minimumNeighbours: response.minimum_neighbours ?? null,
  }
}

const similarMaterialsPath = (id: string) => `${I7_BASE}/recommendations/${encodeURIComponent(id)}/similar-materials`

/** GET /recommendations/{id}/similar-materials -- the neighbours an OAR recommendation was sized from,
 * best first, and the ones a user removed. `items` is `[]` (never fabricated) when it was not sized from
 * similarity. */
export async function fetchSimilarMaterialsView(id: string): Promise<SimilarMaterialsView> {
  return mapSimilarMaterialsView(await apiFetch<ApiSimilarMaterialsResponse>(similarMaterialsPath(id)))
}

/** The neighbours alone -- see `fetchSimilarMaterialsView` for the removed ones and whether editing is allowed. */
export async function fetchSimilarMaterials(id: string): Promise<SimilarMaterial[]> {
  return (await fetchSimilarMaterialsView(id)).items
}

/** The recommendation after a similar material was removed or restored, as the backend recalculated it. */
export interface SimilarMaterialsChange {
  status: string
  safetyStock: number | null
  rop: number | null
  maxStock: number | null
  view: SimilarMaterialsView
}

function mapChange(response: ApiSimilarMaterialsChangeResponse): SimilarMaterialsChange {
  return {
    status: response.status,
    safetyStock: toNumber(response.recommended_safety_stock),
    rop: toNumber(response.recommended_rop),
    maxStock: toNumber(response.recommended_max_stock),
    view: mapSimilarMaterialsView(response.similar_materials),
  }
}

/** POST .../similar-materials/exclusions -- stop using one similar material for THIS material, now and in
 * every later run. The user is whoever the request is made as (the `X-Actor-Id` header the client sets);
 * no user id travels in the body. Refused with 409 -- ApiError, with the backend's reason -- when the
 * recommendation is past review or too few similar materials would remain. */
export async function excludeSimilarMaterial(
  id: string,
  donorMaterial: string,
  donorPlant: string,
  reason?: string,
): Promise<SimilarMaterialsChange> {
  return mapChange(
    await apiFetch<ApiSimilarMaterialsChangeResponse>(`${similarMaterialsPath(id)}/exclusions`, {
      method: "POST",
      body: JSON.stringify({
        donor_material: donorMaterial,
        donor_plant: donorPlant,
        reason: reason?.trim() ? reason.trim() : null,
      }),
    }),
  )
}

/** POST .../similar-materials/exclusions/restore -- make a removed similar material eligible again (a POST
 * because the API has no DELETE; the removal's record is kept, marked restored). */
export async function restoreSimilarMaterial(
  id: string,
  donorMaterial: string,
  donorPlant: string,
): Promise<SimilarMaterialsChange> {
  return mapChange(
    await apiFetch<ApiSimilarMaterialsChangeResponse>(`${similarMaterialsPath(id)}/exclusions/restore`, {
      method: "POST",
      body: JSON.stringify({ donor_material: donorMaterial, donor_plant: donorPlant }),
    }),
  )
}

export interface ForecastVsActual {
  points: { period: string; predicted: number; actual: number; materialCount: number }[]
  /** Material-plants whose backtests are summed into the points. */
  materialsWithHistory: number
  /** Material-plants forecast by the latest run -- the denominator for the caption. */
  materialsInScope: number
}

/** GET /forecast-vs-actual -- the portfolio's champion backtests summed per month,
 * for one plant or every plant. `points` is `[]` (never fabricated) when the latest
 * run has no backtested material-plant in scope. */
export async function fetchForecastVsActual(plant?: string, months = 12): Promise<ForecastVsActual> {
  const search = new URLSearchParams({ months: String(months) })
  if (plant) search.set("plant", plant)
  const response = await apiFetch<ApiForecastVsActualResponse>(`${I7_BASE}/forecast-vs-actual?${search}`)
  return {
    points: response.points.map((point) => ({
      period: point.forecast_period,
      predicted: toNumber(point.predicted) ?? 0,
      actual: toNumber(point.actual) ?? 0,
      materialCount: point.material_count,
    })),
    materialsWithHistory: response.materials_with_history_count,
    materialsInScope: response.materials_in_scope_count,
  }
}

// --- Approvals --------------------------------------------------------

/** GET .../workflow-state -- the same route/pending-role computation
 * submit/actions already return, exposed read-only for a queue/list view
 * that only needs to display current state (see Part 22). */
export async function fetchWorkflowState(id: string): Promise<ApiWorkflowStateResponse> {
  return apiFetch<ApiWorkflowStateResponse>(
    `${I7_BASE}/recommendations/${encodeURIComponent(id)}/workflow-state`,
  )
}

export async function submitForApproval(id: string, actorId: string): Promise<ApiWorkflowStateResponse> {
  return apiFetch<ApiWorkflowStateResponse>(`${I7_BASE}/recommendations/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    body: JSON.stringify({ actor_id: actorId }),
  })
}

/** POST .../reject -- declines a recommendation that has not been sent for approval, straight from the
 * Recommendations page. The backend only accepts it while the recommendation is READY_FOR_REVIEW, and
 * requires a comment (the reason). Once a recommendation is in the approval chain, rejecting it is the
 * pending approver's decision (applyApprovalAction). */
export async function rejectRecommendation(
  id: string,
  actorId: string,
  comment: string,
): Promise<ApiWorkflowStateResponse> {
  return apiFetch<ApiWorkflowStateResponse>(`${I7_BASE}/recommendations/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ actor_id: actorId, comment }),
  })
}

export async function applyApprovalAction(
  id: string,
  actorId: string,
  actorRole: ApiApprovalRole,
  action: ApiApprovalAction,
  comment?: string,
): Promise<ApiWorkflowStateResponse> {
  return apiFetch<ApiWorkflowStateResponse>(`${I7_BASE}/recommendations/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    body: JSON.stringify({ actor_id: actorId, actor_role: actorRole, action, comment: comment ?? null }),
  })
}

export async function fetchApprovalHistory(id: string): Promise<ApiApprovalHistoryResponse> {
  return apiFetch<ApiApprovalHistoryResponse>(`${I7_BASE}/recommendations/${encodeURIComponent(id)}/approval-history`)
}

// --- Quarterly Deep-Dive Report (Step 9) ---------------------------------
//
// GET/POST /v1/i7/reports/quarterly*, mirroring app/api/i7/reports.py. These
// functions return the raw Api* shapes as-is (see types/api.ts) rather than
// reshaping into a camelCase mirror -- the report body is 14 sections of
// mostly-passthrough display data with no existing frontend type to map onto
// (unlike recommendations, which reshape into the pre-existing Recommendation
// type the mock-data UI already used). The one exception is the quarter list,
// which gets a small camelCase convenience shape since it feeds a picker.

export interface QuarterlyReportListRow {
  reportId: number
  quarter: string
  status: ApiGenerationStatusResponse["status"]
  reportVersion: string
  generatedAt: string
  periodStart: string
  periodEnd: string
}

/** GET /reports/quarterly -- summaries only, no report_json. */
export async function fetchQuarterlyReports(limit = 20): Promise<{ items: QuarterlyReportListRow[]; total: number }> {
  const response = await apiFetch<ApiQuarterlyReportListResponse>(
    `${I7_BASE}/reports/quarterly?limit=${encodeURIComponent(String(limit))}`,
  )
  return {
    items: response.items.map((row) => ({
      reportId: row.report_id,
      quarter: row.quarter,
      status: row.status,
      reportVersion: row.report_version,
      generatedAt: row.generated_at,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    })),
    total: response.total,
  }
}

/** GET /reports/quarterly/{quarter} -- the full 14-section report body.
 * Returns null on a 404 (never generated yet), matching
 * fetchRecommendationDetail's existing not-found idiom. */
export async function fetchQuarterlyReport(quarter: string): Promise<ApiQuarterlyReport | null> {
  try {
    return await apiFetch<ApiQuarterlyReport>(`${I7_BASE}/reports/quarterly/${encodeURIComponent(quarter)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** POST /reports/quarterly/generate -- synchronous, typically 40-50s against
 * current data volumes (see app/api/i7/reports.py's module docstring).
 * Idempotent per quarter: calling twice overwrites the one row rather than
 * creating a duplicate. `quarter` is optional -- omit it to have the backend
 * resolve and generate the latest *closed* calendar quarter itself (see
 * `latest_closed_quarter` on the backend); the returned report's
 * `metadata.quarter` says which quarter actually ran. */
export async function generateQuarterlyReport(quarter?: string): Promise<ApiQuarterlyReport> {
  return apiFetch<ApiQuarterlyReport>(`${I7_BASE}/reports/quarterly/generate`, {
    method: "POST",
    body: JSON.stringify(quarter ? { quarter } : {}),
  })
}

/** GET /reports/quarterly/{quarter}/status -- for a polling loop. A quarter
 * that was never generated returns PENDING (not a 404), per the backend's
 * explicit polling-shape design -- never thrown as an error here. */
export async function fetchGenerationStatus(quarter: string): Promise<ApiGenerationStatusResponse> {
  return apiFetch<ApiGenerationStatusResponse>(`${I7_BASE}/reports/quarterly/${encodeURIComponent(quarter)}/status`)
}

/** GET /reports/quarterly/{quarter}/export -- the raw-detail Excel workbook,
 * NOT the management report. Returns a blob URL and suggested filename for
 * the caller to trigger a browser download; does not perform the download
 * itself (no existing file-download precedent in this app to defer to). */
export async function fetchQuarterlyReportExportBlob(
  quarter: string,
): Promise<{ blobUrl: string; filename: string }> {
  const url = `${API_BASE_URL}${I7_BASE}/reports/quarterly/${encodeURIComponent(quarter)}/export`
  const response = await fetch(url)
  if (!response.ok) {
    throw new ApiError(`GET ${url} failed with ${response.status}`, response.status)
  }
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? `i7-quarterly-report-${quarter.replace(/\s+/g, "_")}.xlsx`
  const blob = await response.blob()
  return { blobUrl: URL.createObjectURL(blob), filename }
}

// --- Adoption tracking (FR-9) --------------------------------------------

/** The four real backend adoption states, unreduced -- deliberately not
 * folded through STATUS_MAP/mapStatus(), which collapses all three of
 * ADOPTED/PARTIALLY_ADOPTED/NOT_ADOPTED to "Implemented" for the
 * Pipeline/Approvals views. Adoption Tracking exists specifically to show
 * the distinction those views discard. */
export type AdoptionDisplayStatus = "Adopted" | "Partially adopted" | "Not adopted" | "Unknown"

const ADOPTION_STATUS_MAP: Record<string, AdoptionDisplayStatus> = {
  ADOPTED: "Adopted",
  PARTIALLY_ADOPTED: "Partially adopted",
  NOT_ADOPTED: "Not adopted",
  UNKNOWN: "Unknown",
}

export function mapAdoptionStatus(raw: string): AdoptionDisplayStatus {
  return ADOPTION_STATUS_MAP[raw] ?? "Unknown"
}

/** What the Adoption Tracking page shows in its status column. The backend's
 * UNKNOWN (no SAP evidence) reads as "Pending" while the tracking window is
 * still open, and as "No change recorded" once it has passed. Kept separate
 * from AdoptionDisplayStatus, which the Overview's SAP-adoption filter also
 * uses and which keeps "Unknown". */
export type AdoptionPageStatus =
  | "Adopted"
  | "Partially adopted"
  | "Not adopted"
  | "Pending"
  | "No change recorded"

export function adoptionPageStatus(status: AdoptionDisplayStatus, pending: boolean): AdoptionPageStatus {
  if (status !== "Unknown") return status
  return pending ? "Pending" : "No change recorded"
}

export interface AdoptionFieldLine {
  key: string
  label: string
  expected: string | null
  before: string | null
  now: string | null
  changedOn: string | null
  changedTime: string | null
  daysAfter: number | null
  matched: boolean | null
}

export interface AdoptionListRow {
  recommendationId: string
  materialId: string
  plantId: string
  status: AdoptionDisplayStatus
  /** What the page shows: Unknown becomes Pending or "No change recorded". */
  pageStatus: AdoptionPageStatus
  rawStatus: string
  isConversionAdoption: boolean
  detail: string
  /** The fields the check looked at, e.g. "Reorder point · Max stock". */
  checkType: string
  fields: AdoptionFieldLine[]
  approvedOn: string | null
  windowEndsOn: string | null
  windowOpen: boolean
  pending: boolean
}

export interface AdoptionListResult {
  items: AdoptionListRow[]
  total: number
  page: number
  pageSize: number
}

export interface AdoptionDetailResult {
  recommendationId: string
  status: AdoptionDisplayStatus
  rawStatus: string
  /** Field name -> expected value (what the approved recommendation calls
   * for), e.g. {"reorder_point": "20"} or {"mrp_type": "VB"}. */
  expected: Record<string, string>
  /** Field name -> observed SAP value, from change-document evidence --
   * empty when status is Unknown (no evidence exists to populate this). */
  observed: Record<string, string>
  matchedFields: string[]
  mismatchedFields: string[]
  isConversionAdoption: boolean
  detail: string
}

/** GET /api/v1/i7/recommendations/{id}/adoption -- one recommendation's full
 * reconciliation, including the field-level expected/observed values the
 * list endpoint does not carry. */
export async function fetchAdoptionDetail(recommendationId: string): Promise<AdoptionDetailResult> {
  const response = await apiFetch<ApiAdoptionResponse>(
    `${I7_BASE}/recommendations/${recommendationId}/adoption`,
  )
  return {
    recommendationId: response.recommendation_id,
    status: mapAdoptionStatus(response.status),
    rawStatus: response.status,
    expected: response.expected,
    observed: response.observed,
    matchedFields: response.matched_fields,
    mismatchedFields: response.mismatched_fields,
    isConversionAdoption: response.is_conversion_adoption,
    detail: response.detail,
  }
}

/** One backend adoption row as the page uses it. An older backend that does
 * not send the field breakdown still maps: the check type falls back to the
 * old wording and the field list is empty. */
export function mapAdoptionListItem(row: ApiAdoptionListItem): AdoptionListRow {
  const status = mapAdoptionStatus(row.status)
  const pending = row.pending ?? false
  return {
    recommendationId: row.recommendation_id,
    materialId: row.sap_material_number,
    plantId: row.sap_plant_code,
    status,
    pageStatus: adoptionPageStatus(status, pending),
    rawStatus: row.status,
    isConversionAdoption: row.is_conversion_adoption,
    detail: row.detail,
    checkType:
      row.check_type || (row.is_conversion_adoption ? "Min-Max conversion" : "Planning parameters"),
    fields: (row.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      expected: field.expected,
      before: field.before,
      now: field.now,
      changedOn: field.changed_on,
      changedTime: field.changed_time,
      daysAfter: field.days_after,
      matched: field.matched,
    })),
    approvedOn: row.approved_on ?? null,
    windowEndsOn: row.window_ends_on ?? null,
    windowOpen: row.window_open ?? true,
    pending,
  }
}

/** GET /api/v1/i7/recommendations/adoption -- portfolio-wide, paginated.
 * Accepts the same filter subset as the recommendations list (page/pageSize
 * plus status/plant/material/demandClass/isOar/confidence/criticality);
 * sort/sortDesc do not apply to this endpoint and are ignored if passed. */
export async function fetchAdoptionList(
  params: Omit<RecommendationListParams, "sort" | "sortDesc"> = {},
): Promise<AdoptionListResult> {
  const response = await apiFetch<ApiAdoptionListResponse>(
    `${I7_BASE}/recommendations/adoption${toQueryString(params)}`,
  )
  return {
    items: response.items.map(mapAdoptionListItem),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  }
}

export interface AdoptionSummaryResult {
  totalEvaluated: number
  adoptedCount: number
  partiallyAdoptedCount: number
  notAdoptedCount: number
  unknownCount: number
  /** Rate among recommendations with real SAP evidence (excludes UNKNOWN
   * from the denominator) -- null when every evaluated row is still
   * UNKNOWN, never a fabricated 0%. See ApiAdoptionSummary's own docstring. */
  adoptionRatePercentage: number | null
}

/** What the adoption summary can be narrowed by. All optional; none means the whole portfolio. */
export interface AdoptionSummaryParams {
  /** One SAP plant code. */
  plant?: string
  /** oar | stock_item -- the Overview's Recommendation filter. */
  type?: "oar" | "stock_item"
  /** The stored demand class (see DEMAND_CLASS_FOR_PATTERN). */
  demandClass?: string
  /** Critical | High | Medium | Low -- the level the pages show, not the raw tier. */
  criticalityLevel?: string
}

/** GET /api/v1/i7/recommendations/adoption/summary -- real portfolio-wide
 * counts from the persisted ledger (i7_sap_adoption), not a live
 * re-evaluation. Feeds the Inventory Planning overview's adoption card
 * and the quarterly report's SAP Adoption section. Counts only recommendations
 * with something to adopt (an OAR one eligible for the Min-Max conversion, or a
 * stock item with a changed ROP / safety stock / max stock), the same set
 * `RecommendationListParams.actionable` lists. `plant` narrows to one SAP plant
 * code (the backend joins to Recommendation to get one, since the ledger itself
 * carries no plant column -- see app/api/i7/adoption.py::get_adoption_summary). */
export async function fetchAdoptionSummary(params: AdoptionSummaryParams = {}): Promise<AdoptionSummaryResult> {
  const search = new URLSearchParams()
  if (params.plant) search.set("plant", params.plant)
  if (params.type) search.set("type", params.type)
  if (params.demandClass) search.set("demand_class", params.demandClass)
  if (params.criticalityLevel) search.set("criticality_level", params.criticalityLevel)
  const queryString = search.toString()
  const query = queryString ? `?${queryString}` : ""
  const response = await apiFetch<ApiAdoptionSummary>(`${I7_BASE}/recommendations/adoption/summary${query}`)
  return {
    totalEvaluated: response.total_evaluated,
    adoptedCount: response.adopted_count,
    partiallyAdoptedCount: response.partially_adopted_count,
    notAdoptedCount: response.not_adopted_count,
    unknownCount: response.unknown_count,
    adoptionRatePercentage: response.adoption_rate_percentage,
  }
}

/** GET /api/v1/i7/approval-events -- one page of the approval ledger across all
 * recommendations, newest first. `fromTs` is inclusive and `toTs` exclusive
 * (ISO 8601). Paging and the bounds are applied in SQL by the backend. */
export async function fetchApprovalEvents(
  params: { limit?: number; offset?: number; fromTs?: string; toTs?: string } = {},
): Promise<ApiApprovalEventsResponse> {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.fromTs) search.set("from_ts", params.fromTs)
  if (params.toTs) search.set("to_ts", params.toTs)
  const query = search.toString()
  return apiFetch<ApiApprovalEventsResponse>(`${I7_BASE}/approval-events${query ? `?${query}` : ""}`)
}
