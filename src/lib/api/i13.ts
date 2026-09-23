/**
 * Typed client for the Initiative 13 backend — `/api/i13/*`.
 *
 * Moved here from `features/initiative-13/api/client.ts` so it sits beside
 * `lib/api/i8.ts` and `lib/api/assistant.ts`: one place per backend prefix, none
 * of them inside a feature folder. The old location already imported
 * `lib/api/assistant`, and an I08 route already imports an I13 component, so the
 * feature-folder boundary was not holding in either direction.
 *
 * ## Three things to know before wiring a screen to this
 *
 * **1. This API is snake_case; `/api/i8` and `/api/assistant` are not.** Most of
 * `/api/i13/*` serves `stock_on_hand`, not `stockOnHand` — so every field is
 * mapped by hand below. The two WS7 routes under this prefix
 * (`/consumption-plans`, `/quantity-suggestion/compute`) are the exception: they
 * use pydantic's camel alias generator, so they are read straight through. Do
 * not add a mapper for those.
 *
 * **2. A status the backend adds must not break a table.** Every union is read
 * through `oneOf(value, ALLOWED, fallback)`. These fields feed
 * `Record<Union, Tone>` lookups in the components, and an unguarded cast puts an
 * unrecognised string straight into one.
 *
 * **3. Unknown is not zero.** `toNumber` keeps `undefined` as `undefined`;
 * `toCount` defaults to 0 and is only for counts. On an acquired-vs-plan
 * variance the difference decides whether a row reads "nothing was received" or
 * "nobody recorded what was received", and those are different findings.
 *
 * Base URL comes from `NEXT_PUBLIC_API_BASE_URL` — see `client.ts`.
 */

import { listJustifications } from "@/lib/api/assistant"
import { apiFetch, apiPost } from "@/lib/api/client"
import { oneOf, toCount, toNumber } from "@/lib/api/format"
import {
  ACQUIRED_VS_PLAN_STATUSES,
  ACT_EXCEPTION_STATUSES,
  ACT_EXCEPTION_TYPES,
  AGING_BANDS,
  ATTRIBUTION_STATUSES,
  LEDGER_UTILISATION_STATUSES,
  LINKAGE_STATUSES,
  MATERIAL_SCOPES,
  PROCUREMENT_STATUSES,
  ROUTING_STATUSES,
  type ActException,
  type ActExceptionDetail,
  type ActExceptionEvent,
  type ActExceptionStatus,
  type ActExceptionType,
  type ConsumptionAttribution,
  type ConsumptionPlan,
  type CrossPlantStock,
  type DataSourceStatus,
  type I13Exception,
  type I13Summary,
  type JustificationEntry,
  type QuantitySuggestion,
  type ReclassificationCandidate,
  type RequesterConfirmation,
  type UtilisationLedgerEntry,
  type ValidationResult,
  type WatchMetric,
} from "@/lib/api/i13-types"
import {
  mergeJustifications,
  type UnifiedJustification,
} from "@/lib/assistant/justifications"

export * from "@/lib/api/i13-types"

type RawRecord = Record<string, unknown>

function buildQuery(
  params: Record<string, string | number | boolean | undefined>
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

/** A nullable string field, as `string | null`. Never `undefined` on the wire type. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

// --- Adapters -------------------------------------------------------------

function toDataSourceStatus(raw: RawRecord): DataSourceStatus {
  return {
    entitySet: String(raw.entity_set ?? ""),
    // Deliberately NOT guarded: SourceMode is an open union (the backend may
    // name an entity set's mode anything), and the component already handles
    // an unrecognised value by falling through to its "danger" tone.
    mode: String(raw.mode ?? "UNAVAILABLE"),
    rowCount: toCount(raw.row_count as number),
    available: Boolean(raw.available),
    fetchedAt: String(raw.fetched_at ?? ""),
  }
}

function toLedgerEntry(raw: RawRecord): UtilisationLedgerEntry {
  return {
    ledgerId: String(raw.ledger_id ?? ""),
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    reservationNumber: str(raw.reservation_number),
    reservationItem: str(raw.reservation_item),
    prNumber: str(raw.pr_number),
    prItem: str(raw.pr_item),
    poNumber: str(raw.po_number),
    poItem: str(raw.po_item),
    // Quantities, not counts: a null received quantity means no receipt was
    // recorded, which is not the same statement as "zero units arrived".
    receivedQuantity: toNumber(raw.received_quantity as string) ?? null,
    issuedQuantity: toNumber(raw.issued_quantity as string) ?? null,
    openQuantity: toNumber(raw.open_quantity as string) ?? null,
    firstGrDate: str(raw.first_gr_date),
    latestGrDate: str(raw.latest_gr_date),
    firstGiDate: str(raw.first_gi_date),
    latestGiDate: str(raw.latest_gi_date),
    procurementStatus: oneOf(
      raw.procurement_status as string,
      PROCUREMENT_STATUSES,
      "OPEN"
    ),
    utilisationStatus: oneOf(
      raw.utilisation_status as string,
      LEDGER_UTILISATION_STATUSES,
      "NOT_ISSUED"
    ),
    linkageStatus: oneOf(raw.linkage_status as string, LINKAGE_STATUSES, "UNMATCHED"),
    dataSource: String(raw.data_source ?? ""),
    attributionStatus: raw.attribution_status
      ? oneOf(raw.attribution_status as string, ATTRIBUTION_STATUSES, "UNATTRIBUTED")
      : null,
    attributionEvidence: str(raw.attribution_evidence),
  }
}

function toWatchMetric(raw: RawRecord): WatchMetric {
  return {
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    materialScope: raw.material_scope
      ? oneOf(raw.material_scope as string, MATERIAL_SCOPES, "EXCLUDED")
      : null,

    stockOnHand: toNumber(raw.stock_on_hand as string) ?? null,
    openPoQuantity: toNumber(raw.open_po_quantity as string) ?? null,
    averageMonthlyConsumption: toNumber(raw.average_monthly_consumption as string) ?? null,

    monthsOfCover: toNumber(raw.months_of_cover as string) ?? null,
    projectedMonthsOfCover: toNumber(raw.projected_months_of_cover as string) ?? null,
    monthsOfCoverReason: str(raw.months_of_cover_reason),

    lastMovementDate: str(raw.last_movement_date),
    daysSinceLastMovement: toNumber(raw.days_since_last_movement as number) ?? null,
    lastIssueDate: str(raw.last_issue_date),
    daysSinceLastIssue: toNumber(raw.days_since_last_issue as number) ?? null,
    // A count: "consumed 0 times in 12 months" is exactly what the backend
    // means when it sends 0, and it is the non-mover signal.
    consumptionCount12m: toCount(raw.consumption_count_12m as number),
    consumedQty12m: toNumber(raw.consumed_qty_12m as string) ?? null,
    inventoryTurns: toNumber(raw.inventory_turns as string) ?? null,
    inventoryTurnsReason: str(raw.inventory_turns_reason),
    agingBand: oneOf(raw.aging_band as string, AGING_BANDS, "NON_MOVING"),

    grNotIssuedFlag: Boolean(raw.gr_not_issued_flag),
    grNotIssuedDaysSinceGr: toNumber(raw.gr_not_issued_days_since_gr as number) ?? null,
    grNotIssuedRelevantGrDate: str(raw.gr_not_issued_relevant_gr_date),
    grNotIssuedThresholdDays: toCount(raw.gr_not_issued_threshold_days as number),
    grNotIssuedReceivedQuantity: toNumber(raw.gr_not_issued_received_quantity as string) ?? null,
    grNotIssuedIssuedQuantity: toNumber(raw.gr_not_issued_issued_quantity as string) ?? null,
    grNotIssuedOutstandingQuantity:
      toNumber(raw.gr_not_issued_outstanding_quantity as string) ?? null,

    acquiredVsPlanStatus: oneOf(
      raw.acquired_vs_plan_status as string,
      ACQUIRED_VS_PLAN_STATUSES,
      "NO_PLAN"
    ),
    plannedQuantity: toNumber(raw.planned_quantity as string) ?? null,
    receivedQuantity: toNumber(raw.received_quantity as string) ?? null,
    issuedQuantity: toNumber(raw.issued_quantity as string) ?? null,
    acquiredVsPlanVarianceQuantity:
      toNumber(raw.acquired_vs_plan_variance_quantity as string) ?? null,
    acquiredVsPlanVariancePercentage:
      toNumber(raw.acquired_vs_plan_variance_percentage as string) ?? null,

    calculatedAt: str(raw.calculated_at),
  }
}

function toActException(raw: RawRecord): ActException {
  return {
    exceptionId: String(raw.exception_id ?? ""),
    exceptionType: oneOf(raw.exception_type as string, ACT_EXCEPTION_TYPES, "NO_PLAN"),
    status: oneOf(raw.status as string, ACT_EXCEPTION_STATUSES, "OPEN"),

    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),

    reservationNumber: str(raw.reservation_number),
    reservationItem: str(raw.reservation_item),
    sessionId: str(raw.session_id),
    ledgerEntryId: str(raw.ledger_entry_id),

    ownerRequesterId: str(raw.owner_requester_id),

    detectedAt: String(raw.detected_at ?? ""),
    requesterDueAt: str(raw.requester_due_at),
    escalatedAt: str(raw.escalated_at),
    resolvedAt: str(raw.resolved_at),

    currentAssigneeType:
      raw.current_assignee_type === "REQUESTER" || raw.current_assignee_type === "HOD"
        ? raw.current_assignee_type
        : null,
    currentAssigneeId: str(raw.current_assignee_id),
    routingStatus: raw.routing_status
      ? oneOf(raw.routing_status as string, ROUTING_STATUSES, "ROUTING_PENDING")
      : null,

    reason: String(raw.reason ?? ""),
    evidence: (raw.evidence as Record<string, string>) ?? {},

    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
  }
}

function toRequesterConfirmation(raw: RawRecord): RequesterConfirmation {
  return {
    exceptionId: String(raw.exception_id ?? ""),
    reasonCategory: String(raw.reason_category ?? ""),
    freeText: String(raw.free_text ?? ""),
    actorId: String(raw.actor_id ?? ""),
    submittedAt: String(raw.submitted_at ?? ""),
  }
}

function toActExceptionEvent(raw: RawRecord): ActExceptionEvent {
  return {
    eventId: str(raw.event_id),
    eventType: String(raw.event_type ?? ""),
    fromStatus: raw.from_status
      ? oneOf(raw.from_status as string, ACT_EXCEPTION_STATUSES, "OPEN")
      : null,
    toStatus: raw.to_status
      ? oneOf(raw.to_status as string, ACT_EXCEPTION_STATUSES, "OPEN")
      : null,
    actorId: str(raw.actor_id),
    actorType: String(raw.actor_type ?? ""),
    timestamp: String(raw.timestamp ?? ""),
    metadata: (raw.metadata as Record<string, string>) ?? {},
  }
}

function toCrossPlantStock(raw: RawRecord): CrossPlantStock {
  return {
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    stockOnHand: toNumber(raw.stock_on_hand as string) ?? null,
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
    id: String(raw.id ?? ""),
    type: oneOf(
      raw.type as string,
      ["PLAN_BREACH", "NO_PLAN", "GR_NOT_ISSUED_30_DAY"] as const,
      "NO_PLAN"
    ),
    status: oneOf(
      raw.status as string,
      ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const,
      "OPEN"
    ),
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    reservationNumber: str(raw.reservation_number),
    prNumber: str(raw.pr_number),
    poNumber: str(raw.po_number),
    ownerId: str(raw.owner_id),
    ownerName: str(raw.owner_name),
    createdAt: String(raw.created_at ?? ""),
    dueAt: str(raw.due_at),
    daysOverdue: toNumber(raw.days_overdue as number) ?? null,
    reason: String(raw.reason ?? ""),
    evidence: String(raw.evidence ?? ""),
  }
}

function toReclassificationCandidate(raw: RawRecord): ReclassificationCandidate {
  return {
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    consumptionCount12m: toCount(raw.consumption_count_12m as number),
    consumedMoreThanThreshold: Boolean(raw.consumed_more_than_threshold),
    // Tri-state on purpose. Two of the three SOP indicators have no source, so
    // null means "cannot be determined" and must not collapse into false —
    // see FRS §8 and the status doc's FR-8 row.
    criticalImpactIndicator: (raw.critical_impact_indicator as boolean | null) ?? null,
    hodJustifiedRequestIndicator:
      (raw.hod_justified_request_indicator as boolean | null) ?? null,
    dataAvailable: Boolean(raw.data_available),
    candidateFlag: Boolean(raw.candidate_flag),
    candidateReasons: (raw.candidate_reasons as string[] | null) ?? [],
  }
}

function toConsumptionAttribution(raw: RawRecord): ConsumptionAttribution {
  return {
    ledgerId: String(raw.ledger_id ?? ""),
    material: String(raw.material ?? ""),
    plant: String(raw.plant ?? ""),
    reservationNumber: String(raw.reservation_number ?? ""),
    reservationItem: String(raw.reservation_item ?? ""),
    requesterId: str(raw.requester_id),
    orderNumber: str(raw.order_number),
    costCentre: str(raw.cost_centre),
    status: String(raw.status ?? ""),
    source: String(raw.source ?? ""),
    evidence: String(raw.evidence ?? ""),
    costCentreAttributionEnabled: Boolean(raw.cost_centre_attribution_enabled),
    attributedAt: String(raw.attributed_at ?? ""),
  }
}

function toValidationResult(raw: RawRecord): ValidationResult {
  const results = (raw.results as RawRecord[] | undefined) ?? []
  return {
    tolerancePct: toCount(raw.tolerance_pct as number),
    results: results.map((r) => ({
      sourceName: String(r.source_name ?? ""),
      computedCount: toCount(r.computed_count as number),
      referenceCount: toNumber(r.reference_count as number) ?? null,
      absoluteDifference: toNumber(r.absolute_difference as number) ?? null,
      percentageDifference: toNumber(r.percentage_difference as number) ?? null,
      withinTolerance: (r.within_tolerance as boolean | null) ?? null,
      status: String(r.status ?? ""),
    })),
  }
}

function toSummary(raw: RawRecord): I13Summary {
  return {
    totalOarPositions: toCount(raw.total_oar_positions as number),
    fastMovingCount: toCount(raw.fast_moving_count as number),
    slowMovingCount: toCount(raw.slow_moving_count as number),
    nonMovingCount: toCount(raw.non_moving_count as number),
    grNotIssued30DayCount: toCount(raw.gr_not_issued_30_day_count as number),
    planBreachCount: toCount(raw.plan_breach_count as number),
    noPlanCount: toCount(raw.no_plan_count as number),
    reclassificationCandidateCount: toCount(raw.reclassification_candidate_count as number),
    valuationIsMocked: Boolean(raw.valuation_is_mocked),
  }
}

// --- Endpoints ------------------------------------------------------------

export function getI13Summary(): Promise<I13Summary> {
  return apiFetch<RawRecord>("/i13/summary").then(toSummary)
}

export function getI13DataSources(): Promise<DataSourceStatus[]> {
  return apiFetch<RawRecord[]>("/i13/data-sources").then((rows) =>
    rows.map(toDataSourceStatus)
  )
}

/**
 * `GET /i13/ledger`.
 *
 * **Always send `limit`.** The route defaults it to 100 and caps at 1,000, so a
 * caller that omits it silently receives the first hundred rows and no
 * indication that there were more — which is what this client used to do, and
 * why the ledger screen had been showing at most 100 entries with no
 * disclosure anywhere.
 */
export function getI13Ledger(params?: {
  plant?: string
  material?: string
  limit?: number
  offset?: number
}): Promise<UtilisationLedgerEntry[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    limit: params?.limit ?? 1000,
    offset: params?.offset,
  })
  return apiFetch<RawRecord[]>(`/i13/ledger${query}`).then((rows) => rows.map(toLedgerEntry))
}

export function getI13LedgerEntry(ledgerId: string): Promise<UtilisationLedgerEntry> {
  return apiFetch<RawRecord>(`/i13/ledger/${encodeURIComponent(ledgerId)}`).then(
    toLedgerEntry
  )
}

export function getI13Watch(params?: {
  plant?: string
  material?: string
  agingBand?: string
}): Promise<WatchMetric[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    aging_band: params?.agingBand,
  })
  return apiFetch<RawRecord[]>(`/i13/watch${query}`).then((rows) => rows.map(toWatchMetric))
}

/**
 * `GET /i13/exceptions` — **W6.3's older, ephemeral exception queue.**
 *
 * Recomputed per request, no owner, no state machine, no audit trail, no
 * session reference. FR-9's real queue is `getI13ActExceptions` below, and the
 * Exceptions screen reads that one now. Kept here because nothing has confirmed
 * this route can be retired yet; do not wire a new screen to it.
 */
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
  return apiFetch<RawRecord[]>(`/i13/reclassification${query}`).then((rows) =>
    rows.map(toReclassificationCandidate)
  )
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

// --- W6.4 consumption attribution -----------------------------------------

/**
 * `GET /i13/consumption-attribution` — who owns the consumption on a
 * reservation line, and where that was resolved from.
 *
 * FRS acceptance criterion 3 asks for unmatched records to be *reported rather
 * than inferred*, and this is the endpoint that reports them: an AMBIGUOUS
 * status carries the conflicting candidates in `evidence` instead of picking
 * one. It is also the source ACT now routes exceptions from.
 */
export function getI13ConsumptionAttribution(params?: {
  material?: string
  plant?: string
  reservationNumber?: string
  limit?: number
}): Promise<ConsumptionAttribution[]> {
  const query = buildQuery({
    material: params?.material,
    plant: params?.plant,
    reservation_number: params?.reservationNumber,
    limit: params?.limit,
  })
  return apiFetch<RawRecord[]>(`/i13/consumption-attribution${query}`).then((rows) =>
    rows.map(toConsumptionAttribution)
  )
}

// --- WS7: the assistant's own I13 records ---------------------------------
//
// These two routes serve camelCase (pydantic's alias generator), unlike the
// rest of this prefix — so they are read straight through with no mapper. See
// the module note at the top.

/**
 * `GET /i13/consumption-plans` — the plans this platform actually captured.
 *
 * Deliberately **not** merged with the 742 fabricated rows in
 * `consumption_plans.csv`. Everything returned here was stated by a person in a
 * conversation, which is the single most important thing to be able to say
 * before anybody demos the exception queue.
 */
export function getI13ConsumptionPlans(params?: {
  sessionId?: string
  material?: string
  plant?: string
  limit?: number
}): Promise<ConsumptionPlan[]> {
  const query = buildQuery({
    session_id: params?.sessionId,
    material: params?.material,
    plant: params?.plant,
    limit: params?.limit,
  })
  return apiFetch<ConsumptionPlan[]>(`/i13/consumption-plans${query}`)
}

/**
 * `GET /i13/quantity-suggestion/compute` — FR-3, without a conversation.
 *
 * Named `/compute` because `/i13/quantity-suggestion` belongs to the W7.4
 * *store*, which lists suggestions that were recorded. This one computes a
 * fresh one and stores nothing. Read `available` before `suggestedQuantity`: a
 * null suggestion means none could be made, never zero.
 */
export function computeI13QuantitySuggestion(params: {
  material: string
  plant: string
  quantity: string
}): Promise<QuantitySuggestion> {
  const query = buildQuery({
    material: params.material,
    plant: params.plant,
    quantity: params.quantity,
  })
  return apiFetch<QuantitySuggestion>(`/i13/quantity-suggestion/compute${query}`)
}

// --- W6.6 ACT -------------------------------------------------------------
//
// `getI13ActUtilisation` prefers the persisted W6.3 mart over the
// live-computed `/i13/watch` above (richer filters: `grni`,
// `acquiredVsPlanStatus`). Both return the same `WatchMetricResponse` shape.

export function getI13ActUtilisation(params?: {
  plant?: string
  material?: string
  agingBand?: string
  grni?: boolean
  acquiredVsPlanStatus?: string
  limit?: number
  offset?: number
}): Promise<WatchMetric[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    aging_band: params?.agingBand,
    grni: params?.grni === undefined ? undefined : String(params.grni),
    acquired_vs_plan_status: params?.acquiredVsPlanStatus,
    limit: params?.limit,
    offset: params?.offset,
  })
  return apiFetch<RawRecord[]>(`/i13/act/utilisation${query}`).then((rows) =>
    rows.map(toWatchMetric)
  )
}

export function getI13ActExceptions(params?: {
  plant?: string
  material?: string
  type?: string
  status?: string
  ownerRequesterId?: string
  limit?: number
  offset?: number
}): Promise<ActException[]> {
  const query = buildQuery({
    plant: params?.plant,
    material: params?.material,
    type: params?.type,
    status: params?.status,
    owner_requester_id: params?.ownerRequesterId,
    limit: params?.limit,
    offset: params?.offset,
  })
  return apiFetch<RawRecord[]>(`/i13/act/exceptions${query}`).then((rows) =>
    rows.map(toActException)
  )
}

export function getI13ActExceptionDetail(exceptionId: string): Promise<ActExceptionDetail> {
  return apiFetch<RawRecord>(
    `/i13/act/exceptions/${encodeURIComponent(exceptionId)}`
  ).then(toActExceptionDetail)
}

/**
 * `GET /i13/act/exceptions/{id}/history` — every state change, with actor and
 * timestamp.
 *
 * FRS acceptance criterion 6 ends "every state change is logged". This is the
 * log, and until now nothing rendered it.
 */
export function getI13ActExceptionHistory(
  exceptionId: string
): Promise<ActExceptionEvent[]> {
  return apiFetch<RawRecord[]>(
    `/i13/act/exceptions/${encodeURIComponent(exceptionId)}/history`
  ).then((rows) => rows.map(toActExceptionEvent))
}

/**
 * `POST /i13/act/exceptions/{id}/confirmation` — the requester's structured
 * answer (FR-7, FR-9).
 *
 * **A real state transition**, validated by the backend's state machine and
 * appended to an audit trail that cannot be edited. It replaces the local
 * `useState` the Exceptions board used to advance a status with, which recorded
 * nothing anywhere.
 *
 * No retry on failure. The exception may have moved before the response was
 * lost, and a second POST against an append-only table is a second confirmation
 * against one decision. A 422 means the transition is not legal from the
 * exception's current status — for example confirming one that is still `OPEN`
 * because it was never routed to anybody.
 */
export function submitI13ActConfirmation(
  exceptionId: string,
  body: { reasonCategory: string; freeText: string }
): Promise<ActException> {
  return apiPost<RawRecord>(
    `/i13/act/exceptions/${encodeURIComponent(exceptionId)}/confirmation`,
    { reason_category: body.reasonCategory, free_text: body.freeText }
  ).then(toActException)
}

/**
 * `POST /i13/act/run/detect` — re-run detection.
 *
 * The only thing that moves any number on these screens. There is no scheduler
 * (FRS FR-6 asks for a daily refresh; the status doc records its absence), so
 * this is how a refresh happens today. It writes: it creates, reuses, resolves
 * and routes exceptions across the whole OAR population unless narrowed.
 */
export function runI13Detection(params?: {
  material?: string
  plant?: string
}): Promise<{ asOfTime: string; created: number; reused: number; resolved: number; routed: number }> {
  return apiPost<RawRecord>("/i13/act/run/detect", {
    material: params?.material,
    plant: params?.plant,
  }).then((raw) => ({
    asOfTime: String(raw.as_of_time ?? ""),
    created: toCount(raw.created as number),
    reused: toCount(raw.reused as number),
    resolved: toCount(raw.resolved as number),
    routed: toCount(raw.routed as number),
  }))
}

// --- Justifications -------------------------------------------------------
//
// The ACT API has no bulk "list every confirmation" endpoint (see
// `app/schemas/i13_act.py`): a confirmation only appears nested inside one
// exception's detail response. `getI13Justifications` composes the two
// read-only endpoints that do exist — list exceptions whose status implies a
// confirmation was recorded, then fetch detail for a *bounded* page of those —
// and keeps only entries whose `confirmation` actually came back non-null.

const JUSTIFICATION_CANDIDATE_STATUSES: readonly ActExceptionStatus[] = [
  "CONFIRMED",
  "RESOLVED",
]
const MAX_JUSTIFICATION_DETAIL_FETCH = 30

export async function getI13Justifications(params?: {
  plant?: string
  material?: string
}): Promise<JustificationEntry[]> {
  const lists = await Promise.all(
    JUSTIFICATION_CANDIDATE_STATUSES.map((status) =>
      getI13ActExceptions({
        plant: params?.plant,
        material: params?.material,
        status,
      })
    )
  )
  const candidates = lists.flat().slice(0, MAX_JUSTIFICATION_DETAIL_FETCH)
  const details = await Promise.all(
    candidates.map((c) => getI13ActExceptionDetail(c.exceptionId))
  )
  return selectConfirmedExceptions(details)
}

/**
 * Every justification for this plant and material, from BOTH tables.
 *
 * The ACT half above is only one of the two places a reason is recorded. The
 * other is the shared `justification` table, written by the assistant at
 * reservation time — `NEW_ACQUISITION` and `QUANTITY_OVERRIDE`, the records I08
 * FR-7 and I13 FR-7 ask for by name.
 *
 * The two are disjoint: only `app/api/assistant/router.py` and
 * `app/assistant/turns.py` write the shared table, and the ACT confirmation
 * route writes nowhere near it. So they concatenate without dedupe.
 *
 * Note the asymmetry in cost. The shared table is ONE request. The ACT half is
 * two list calls plus up to thirty detail fetches, because a confirmation is
 * only visible on an exception's detail. That is why the fetch is capped, and
 * why this now runs on the server rather than in the browser on every keystroke.
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

/** Pure, unit-testable half of `getI13Justifications` — no network. */
export function selectConfirmedExceptions(
  details: ActExceptionDetail[]
): JustificationEntry[] {
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

export type { ActExceptionType }
