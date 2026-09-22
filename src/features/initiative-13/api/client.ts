// Initiative 13 — typed functions for `GET /api/i13/*` on top of the shared
// `apiFetch` client. Each function does field renaming only (snake_case wire
// format -> camelCase) — no derived/computed fields. All classification,
// aggregation and reconciliation math stays in the FastAPI backend.

import { apiFetch } from "@/lib/api/client"
import { listJustifications } from "@/lib/api/assistant"
import {
  mergeJustifications,
  type UnifiedJustification,
} from "@/lib/assistant/justifications"
import type {
  ActException,
  ActExceptionDetail,
  ActExceptionStatus,
  ActExceptionType,
  CrossPlantStock,
  DataSourceStatus,
  I13Exception,
  I13Summary,
  JustificationEntry,
  ReclassificationCandidate,
  RequesterConfirmation,
  UtilisationLedgerEntry,
  ValidationResult,
  WatchMetric,
} from "./types"

type RawRecord = Record<string, unknown>

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

function toDataSourceStatus(raw: RawRecord): DataSourceStatus {
  return {
    entitySet: raw.entity_set as string,
    mode: raw.mode as DataSourceStatus["mode"],
    rowCount: raw.row_count as number,
    available: raw.available as boolean,
    fetchedAt: raw.fetched_at as string,
  }
}

function toLedgerEntry(raw: RawRecord): UtilisationLedgerEntry {
  return {
    ledgerId: raw.ledger_id as string,
    material: raw.material as string,
    plant: raw.plant as string,
    reservationNumber: (raw.reservation_number as string | null) ?? null,
    reservationItem: (raw.reservation_item as string | null) ?? null,
    prNumber: (raw.pr_number as string | null) ?? null,
    prItem: (raw.pr_item as string | null) ?? null,
    poNumber: (raw.po_number as string | null) ?? null,
    poItem: (raw.po_item as string | null) ?? null,
    receivedQuantity: Number(raw.received_quantity ?? 0),
    issuedQuantity: Number(raw.issued_quantity ?? 0),
    openQuantity: Number(raw.open_quantity ?? 0),
    firstGrDate: (raw.first_gr_date as string | null) ?? null,
    latestGrDate: (raw.latest_gr_date as string | null) ?? null,
    firstGiDate: (raw.first_gi_date as string | null) ?? null,
    latestGiDate: (raw.latest_gi_date as string | null) ?? null,
    procurementStatus: raw.procurement_status as UtilisationLedgerEntry["procurementStatus"],
    utilisationStatus: raw.utilisation_status as UtilisationLedgerEntry["utilisationStatus"],
    linkageStatus: raw.linkage_status as UtilisationLedgerEntry["linkageStatus"],
    dataSource: raw.data_source as string,
    attributionStatus: (raw.attribution_status as UtilisationLedgerEntry["attributionStatus"]) ?? null,
    attributionEvidence: (raw.attribution_evidence as string | null) ?? null,
  }
}

function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function toWatchMetric(raw: RawRecord): WatchMetric {
  return {
    material: raw.material as string,
    plant: raw.plant as string,
    materialScope: (raw.material_scope as WatchMetric["materialScope"]) ?? null,

    stockOnHand: numOrNull(raw.stock_on_hand),
    openPoQuantity: Number(raw.open_po_quantity ?? 0),
    averageMonthlyConsumption: Number(raw.average_monthly_consumption ?? 0),

    monthsOfCover: numOrNull(raw.months_of_cover),
    projectedMonthsOfCover: numOrNull(raw.projected_months_of_cover),
    monthsOfCoverReason: (raw.months_of_cover_reason as string | null) ?? null,

    lastMovementDate: (raw.last_movement_date as string | null) ?? null,
    daysSinceLastMovement: numOrNull(raw.days_since_last_movement),
    lastIssueDate: (raw.last_issue_date as string | null) ?? null,
    daysSinceLastIssue: numOrNull(raw.days_since_last_issue),
    consumptionCount12m: Number(raw.consumption_count_12m ?? 0),
    consumedQty12m: Number(raw.consumed_qty_12m ?? 0),
    inventoryTurns: numOrNull(raw.inventory_turns),
    inventoryTurnsReason: (raw.inventory_turns_reason as string | null) ?? null,
    agingBand: raw.aging_band as WatchMetric["agingBand"],

    grNotIssuedFlag: Boolean(raw.gr_not_issued_flag),
    grNotIssuedDaysSinceGr: numOrNull(raw.gr_not_issued_days_since_gr),
    grNotIssuedRelevantGrDate: (raw.gr_not_issued_relevant_gr_date as string | null) ?? null,
    grNotIssuedThresholdDays: Number(raw.gr_not_issued_threshold_days ?? 0),
    grNotIssuedReceivedQuantity: Number(raw.gr_not_issued_received_quantity ?? 0),
    grNotIssuedIssuedQuantity: Number(raw.gr_not_issued_issued_quantity ?? 0),
    grNotIssuedOutstandingQuantity: Number(raw.gr_not_issued_outstanding_quantity ?? 0),

    acquiredVsPlanStatus: raw.acquired_vs_plan_status as WatchMetric["acquiredVsPlanStatus"],
    plannedQuantity: numOrNull(raw.planned_quantity),
    receivedQuantity: Number(raw.received_quantity ?? 0),
    issuedQuantity: Number(raw.issued_quantity ?? 0),
    acquiredVsPlanVarianceQuantity: numOrNull(raw.acquired_vs_plan_variance_quantity),
    acquiredVsPlanVariancePercentage: numOrNull(raw.acquired_vs_plan_variance_percentage),

    calculatedAt: (raw.calculated_at as string | null) ?? null,
  }
}

function toActException(raw: RawRecord): ActException {
  return {
    exceptionId: raw.exception_id as string,
    exceptionType: raw.exception_type as ActExceptionType,
    status: raw.status as ActExceptionStatus,

    material: raw.material as string,
    plant: raw.plant as string,

    reservationNumber: (raw.reservation_number as string | null) ?? null,
    reservationItem: (raw.reservation_item as string | null) ?? null,
    sessionId: (raw.session_id as string | null) ?? null,
    ledgerEntryId: (raw.ledger_entry_id as string | null) ?? null,

    ownerRequesterId: (raw.owner_requester_id as string | null) ?? null,

    detectedAt: raw.detected_at as string,
    requesterDueAt: (raw.requester_due_at as string | null) ?? null,
    escalatedAt: (raw.escalated_at as string | null) ?? null,
    resolvedAt: (raw.resolved_at as string | null) ?? null,

    currentAssigneeType: (raw.current_assignee_type as ActException["currentAssigneeType"]) ?? null,
    currentAssigneeId: (raw.current_assignee_id as string | null) ?? null,
    routingStatus: (raw.routing_status as ActException["routingStatus"]) ?? null,

    reason: raw.reason as string,
    evidence: (raw.evidence as Record<string, string>) ?? {},

    createdAt: (raw.created_at as string | null) ?? null,
    updatedAt: (raw.updated_at as string | null) ?? null,
  }
}

function toRequesterConfirmation(raw: RawRecord): RequesterConfirmation {
  return {
    exceptionId: raw.exception_id as string,
    reasonCategory: raw.reason_category as string,
    freeText: raw.free_text as string,
    actorId: raw.actor_id as string,
    submittedAt: raw.submitted_at as string,
  }
}

function toCrossPlantStock(raw: RawRecord): CrossPlantStock {
  return {
    material: raw.material as string,
    plant: raw.plant as string,
    stockOnHand: Number(raw.stock_on_hand ?? 0),
  }
}

function toActExceptionDetail(raw: RawRecord): ActExceptionDetail {
  const crossPlantStock = (raw.cross_plant_stock as RawRecord[] | undefined) ?? []
  const confirmation = raw.confirmation as RawRecord | null | undefined
  return {
    ...toActException(raw),
    crossPlantStock: crossPlantStock.map(toCrossPlantStock),
    confirmation: confirmation ? toRequesterConfirmation(confirmation) : null,
  }
}

function toException(raw: RawRecord): I13Exception {
  return {
    id: raw.id as string,
    type: raw.type as I13Exception["type"],
    status: raw.status as I13Exception["status"],
    material: raw.material as string,
    plant: raw.plant as string,
    reservationNumber: (raw.reservation_number as string | null) ?? null,
    prNumber: (raw.pr_number as string | null) ?? null,
    poNumber: (raw.po_number as string | null) ?? null,
    ownerId: (raw.owner_id as string | null) ?? null,
    ownerName: (raw.owner_name as string | null) ?? null,
    createdAt: raw.created_at as string,
    dueAt: (raw.due_at as string | null) ?? null,
    daysOverdue: raw.days_overdue === null || raw.days_overdue === undefined ? null : Number(raw.days_overdue),
    reason: raw.reason as string,
    evidence: raw.evidence as string,
  }
}

function toReclassificationCandidate(raw: RawRecord): ReclassificationCandidate {
  return {
    material: raw.material as string,
    plant: raw.plant as string,
    consumptionCount12m: Number(raw.consumption_count_12m ?? 0),
    consumedMoreThanThreshold: Boolean(raw.consumed_more_than_threshold),
    criticalImpactIndicator: (raw.critical_impact_indicator as boolean | null) ?? null,
    hodJustifiedRequestIndicator: (raw.hod_justified_request_indicator as boolean | null) ?? null,
    dataAvailable: Boolean(raw.data_available),
    candidateFlag: Boolean(raw.candidate_flag),
    candidateReasons: (raw.candidate_reasons as string[] | null) ?? [],
  }
}

function toValidationResult(raw: RawRecord): ValidationResult {
  const results = (raw.results as RawRecord[] | undefined) ?? []
  return {
    tolerancePct: Number(raw.tolerance_pct ?? 0),
    results: results.map((r) => ({
      sourceName: r.source_name as string,
      computedCount: Number(r.computed_count ?? 0),
      referenceCount: r.reference_count === null || r.reference_count === undefined ? null : Number(r.reference_count),
      absoluteDifference:
        r.absolute_difference === null || r.absolute_difference === undefined ? null : Number(r.absolute_difference),
      percentageDifference:
        r.percentage_difference === null || r.percentage_difference === undefined
          ? null
          : Number(r.percentage_difference),
      withinTolerance: (r.within_tolerance as boolean | null) ?? null,
      status: r.status as string,
    })),
  }
}

function toSummary(raw: RawRecord): I13Summary {
  return {
    totalOarPositions: Number(raw.total_oar_positions ?? 0),
    fastMovingCount: Number(raw.fast_moving_count ?? 0),
    slowMovingCount: Number(raw.slow_moving_count ?? 0),
    nonMovingCount: Number(raw.non_moving_count ?? 0),
    grNotIssued30DayCount: Number(raw.gr_not_issued_30_day_count ?? 0),
    planBreachCount: Number(raw.plan_breach_count ?? 0),
    noPlanCount: Number(raw.no_plan_count ?? 0),
    reclassificationCandidateCount: Number(raw.reclassification_candidate_count ?? 0),
    valuationIsMocked: Boolean(raw.valuation_is_mocked),
  }
}

export function getI13Summary(): Promise<I13Summary> {
  return apiFetch<RawRecord>("/i13/summary").then(toSummary)
}

export function getI13DataSources(): Promise<DataSourceStatus[]> {
  return apiFetch<RawRecord[]>("/i13/data-sources").then((rows) => rows.map(toDataSourceStatus))
}

export function getI13Ledger(params?: { plant?: string; material?: string }): Promise<UtilisationLedgerEntry[]> {
  const query = buildQuery({ plant: params?.plant, material: params?.material })
  return apiFetch<RawRecord[]>(`/i13/ledger${query}`).then((rows) => rows.map(toLedgerEntry))
}

export function getI13LedgerEntry(ledgerId: string): Promise<UtilisationLedgerEntry> {
  return apiFetch<RawRecord>(`/i13/ledger/${encodeURIComponent(ledgerId)}`).then(toLedgerEntry)
}

export function getI13Watch(params?: {
  plant?: string
  material?: string
  agingBand?: string
}): Promise<WatchMetric[]> {
  const query = buildQuery({ plant: params?.plant, material: params?.material, aging_band: params?.agingBand })
  return apiFetch<RawRecord[]>(`/i13/watch${query}`).then((rows) => rows.map(toWatchMetric))
}

export function getI13Exceptions(params?: {
  plant?: string
  material?: string
  exceptionType?: string
  status?: string
}): Promise<I13Exception[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    exception_type: params?.exceptionType,
    status: params?.status,
  })
  return apiFetch<RawRecord[]>(`/i13/exceptions${query}`).then((rows) => rows.map(toException))
}

export function getI13Reclassification(params?: {
  plant?: string
  material?: string
}): Promise<ReclassificationCandidate[]> {
  const query = buildQuery({ plant: params?.plant, material: params?.material })
  return apiFetch<RawRecord[]>(`/i13/reclassification${query}`).then((rows) => rows.map(toReclassificationCandidate))
}

export function getI13Validation(params?: {
  zmm065ReferenceCount?: number
  gr30DayReferenceCount?: number
}): Promise<ValidationResult> {
  const query = buildQuery({
    zmm065_reference_count: params?.zmm065ReferenceCount,
    gr_30_day_reference_count: params?.gr30DayReferenceCount,
  })
  return apiFetch<RawRecord>(`/i13/validation${query}`).then(toValidationResult)
}

// --- W6.6 ACT (persisted WATCH mart + exception queue) ---
//
// Read-only over `/api/i13/act/*`. `getI13ActUtilisation` prefers the
// persisted mart (richer filters: `grni`, `acquiredVsPlanStatus`) over the
// live-computed `/i13/watch` above for dashboard consumption, per that
// route's own docstring ("Read-only over the persisted W6.3 mart"). Both
// endpoints return the same `WatchMetricResponse` shape.

export function getI13ActUtilisation(params?: {
  plant?: string
  material?: string
  agingBand?: string
  grni?: boolean
  acquiredVsPlanStatus?: string
}): Promise<WatchMetric[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    aging_band: params?.agingBand,
    grni: params?.grni === undefined ? undefined : String(params.grni),
    acquired_vs_plan_status: params?.acquiredVsPlanStatus,
  })
  return apiFetch<RawRecord[]>(`/i13/act/utilisation${query}`).then((rows) => rows.map(toWatchMetric))
}

export function getI13ActExceptions(params?: {
  plant?: string
  material?: string
  type?: string
  status?: string
  ownerRequesterId?: string
}): Promise<ActException[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    type: params?.type,
    status: params?.status,
    owner_requester_id: params?.ownerRequesterId,
  })
  return apiFetch<RawRecord[]>(`/i13/act/exceptions${query}`).then((rows) => rows.map(toActException))
}

export function getI13ActExceptionDetail(exceptionId: string): Promise<ActExceptionDetail> {
  return apiFetch<RawRecord>(`/i13/act/exceptions/${encodeURIComponent(exceptionId)}`).then(toActExceptionDetail)
}

// The ACT API has no bulk "list every confirmation" endpoint (see
// `app/schemas/i13_act.py` on the backend) -- a confirmation only appears
// nested inside one exception's detail response. `getI13Justifications`
// composes the two read-only endpoints that do exist: list exceptions whose
// status implies a confirmation was recorded (`submit_confirmation` always
// moves an exception to CONFIRMED; RESOLVED may have passed through
// CONFIRMED first), then fetches detail for a *bounded* page of those --
// never the full unfiltered exception set -- and keeps only entries whose
// `confirmation` actually came back non-null.
const JUSTIFICATION_CANDIDATE_STATUSES = ["CONFIRMED", "RESOLVED"] as const
const MAX_JUSTIFICATION_DETAIL_FETCH = 30

export async function getI13Justifications(params?: { plant?: string; material?: string }): Promise<JustificationEntry[]> {
  const lists = await Promise.all(
    JUSTIFICATION_CANDIDATE_STATUSES.map((status) =>
      getI13ActExceptions({ plant: params?.plant, material: params?.material, status })
    )
  )
  const candidates = lists.flat().slice(0, MAX_JUSTIFICATION_DETAIL_FETCH)
  const details = await Promise.all(candidates.map((c) => getI13ActExceptionDetail(c.exceptionId)))
  return selectConfirmedExceptions(details)
}

/**
 * Every justification for this plant and material, from BOTH tables.
 *
 * The ACT half above is only one of the two places a reason is recorded. The
 * other is the shared `justification` table, written by the assistant at
 * reservation time -- `NEW_ACQUISITION` and `QUANTITY_OVERRIDE`, which are the
 * records I08 FR-7 and I13 FR-3 ask for by name. The dashboard read only the
 * ACT half, so the reasons captured at the moment of the decision were absent
 * from the screen built to show them.
 *
 * The two are disjoint: only `app/api/assistant/router.py` and
 * `app/assistant/turns.py` write the shared table, and the ACT confirmation
 * route writes nowhere near it. So they concatenate without dedupe.
 *
 * Note the asymmetry in cost. The shared table is ONE request. The ACT half is
 * two list calls plus up to thirty detail fetches, because a confirmation is
 * only visible on an exception's detail. That is pre-existing and is why the
 * fetch is capped; the cap is disclosed on screen rather than silently
 * truncating.
 */
export async function getI13AllJustifications(params?: {
  plant?: string
  material?: string
}): Promise<UnifiedJustification[]> {
  const [platform, act] = await Promise.all([
    listJustifications({
      plant: params?.plant || undefined,
      material: params?.material || undefined,
      limit: 200,
    }),
    getI13Justifications(params),
  ])
  return mergeJustifications(platform.items, act)
}

/** Pure, unit-testable half of `getI13Justifications` -- no network. */
export function selectConfirmedExceptions(details: ActExceptionDetail[]): JustificationEntry[] {
  return details
    .filter((d) => d.confirmation !== null)
    .map((d) => ({
      exceptionId: d.exceptionId,
      exceptionType: d.exceptionType,
      material: d.material,
      plant: d.plant,
      ownerRequesterId: d.ownerRequesterId,
      reasonCategory: d.confirmation!.reasonCategory,
      freeText: d.confirmation!.freeText,
      actorId: d.confirmation!.actorId,
      submittedAt: d.confirmation!.submittedAt,
    }))
}
