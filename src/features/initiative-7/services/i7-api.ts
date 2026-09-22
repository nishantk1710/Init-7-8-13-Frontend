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
  ApiAdoptionListResponse,
  ApiApprovalAction,
  ApiApprovalHistoryResponse,
  ApiApprovalRole,
  ApiDecimal,
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
  UNCLASSIFIED: "Intermittent",
}

function mapDemandPattern(raw: string | null): DemandPattern {
  if (!raw) return "Intermittent"
  return DEMAND_MAP[raw.toUpperCase()] ?? "Intermittent"
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
  if (mapped === "Critical") return "critical"
  if (mapped === "High") return "high"
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

function materialRefFor(materialNumber: string): MaterialReference {
  // Live recommendations use the real SAP material number as both id and
  // code -- there is no app-side catalog entry to join against (see
  // lib/sap/dataset-mode.ts's identity-gap note), so no description beyond
  // the number itself is available here.
  return { materialId: materialNumber, materialCode: materialNumber, description: materialNumber }
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
    material: materialRefFor(row.material),
    plantId: row.plant,
    circuit: "Unassigned",
    criticality,
    demandPattern: mapDemandPattern(row.demand_class),
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
    unitPrice: toNumber(row.unit_price) ?? 0,
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
  const criticality = mapCriticality(detail.criticality.value)
  const factors: RecommendationFactor[] = detail.blocking_reason
    ? [{ label: "Blocked", detail: detail.blocking_reason }]
    : []

  return {
    id: detail.recommendation_id,
    material: materialRefFor(detail.material),
    plantId: detail.plant,
    circuit: mapCircuit(detail.circuit),
    criticality,
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
    unitPrice: toNumber(detail.unit_price) ?? 0,
    annualConsumption: (toNumber(detail.demand.forecast_rate) ?? 0) * 12,
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
    // FRS SOP 3.1.1 -- only OAR materials have a conversion decision at all;
    // a Min-Max (non-OAR) recommendation never ran conversion.evaluate(), so
    // showing this for is_oar === false/null would be a fabricated section.
    oarConversion: detail.oar.is_oar
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
  confidence?: string
  criticality?: string
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
  if (params.confidence) search.set("confidence", params.confidence)
  if (params.criticality) search.set("criticality", params.criticality)
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
  netSafetyStockValueImpact: number | null
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
    netSafetyStockValueImpact: toNumber(response.net_safety_stock_value_impact),
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
 * creating a duplicate. */
export async function generateQuarterlyReport(quarter: string): Promise<ApiQuarterlyReport> {
  return apiFetch<ApiQuarterlyReport>(`${I7_BASE}/reports/quarterly/generate`, {
    method: "POST",
    body: JSON.stringify({ quarter }),
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

export interface AdoptionListRow {
  recommendationId: string
  materialId: string
  plantId: string
  status: AdoptionDisplayStatus
  rawStatus: string
  isConversionAdoption: boolean
  detail: string
}

export interface AdoptionListResult {
  items: AdoptionListRow[]
  total: number
  page: number
  pageSize: number
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
    items: response.items.map((row) => ({
      recommendationId: row.recommendation_id,
      materialId: row.sap_material_number,
      plantId: row.sap_plant_code,
      status: mapAdoptionStatus(row.status),
      rawStatus: row.status,
      isConversionAdoption: row.is_conversion_adoption,
      detail: row.detail,
    })),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  }
}
