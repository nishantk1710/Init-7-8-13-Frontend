// Initiative 13 — typed functions for `GET /api/i13/*` on top of the shared
// `apiFetch` client. Each function does field renaming only (snake_case wire
// format -> camelCase) — no derived/computed fields. All classification,
// aggregation and reconciliation math stays in the FastAPI backend.

import { apiFetch } from "@/lib/api/client"
import type {
  DataSourceStatus,
  I13Exception,
  I13Summary,
  ReclassificationCandidate,
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

function toWatchMetric(raw: RawRecord): WatchMetric {
  return {
    material: raw.material as string,
    plant: raw.plant as string,
    monthsOfCover: raw.months_of_cover === null || raw.months_of_cover === undefined ? null : Number(raw.months_of_cover),
    monthsOfCoverReason: (raw.months_of_cover_reason as string | null) ?? null,
    daysSinceLastMovement:
      raw.days_since_last_movement === null || raw.days_since_last_movement === undefined
        ? null
        : Number(raw.days_since_last_movement),
    consumptionCount12m: Number(raw.consumption_count_12m ?? 0),
    consumedQty12m: Number(raw.consumed_qty_12m ?? 0),
    inventoryTurns: raw.inventory_turns === null || raw.inventory_turns === undefined ? null : Number(raw.inventory_turns),
    inventoryTurnsReason: (raw.inventory_turns_reason as string | null) ?? null,
    agingBand: raw.aging_band as WatchMetric["agingBand"],
    grNotIssuedFlag: Boolean(raw.gr_not_issued_flag),
    grNotIssuedDaysSinceGr:
      raw.gr_not_issued_days_since_gr === null || raw.gr_not_issued_days_since_gr === undefined
        ? null
        : Number(raw.gr_not_issued_days_since_gr),
    grNotIssuedReceivedQuantity: Number(raw.gr_not_issued_received_quantity ?? 0),
    grNotIssuedIssuedQuantity: Number(raw.gr_not_issued_issued_quantity ?? 0),
    grNotIssuedOutstandingQuantity: Number(raw.gr_not_issued_outstanding_quantity ?? 0),
    acquiredVsPlanStatus: raw.acquired_vs_plan_status as WatchMetric["acquiredVsPlanStatus"],
    plannedQuantity: raw.planned_quantity === null || raw.planned_quantity === undefined ? null : Number(raw.planned_quantity),
    receivedQuantity: Number(raw.received_quantity ?? 0),
    issuedQuantity: Number(raw.issued_quantity ?? 0),
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
