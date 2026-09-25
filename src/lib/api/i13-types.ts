/**
 * Initiative 13 — wire types for `/api/i13/*`, mirroring
 * `Init-7-8-13-Backend/app/schemas/i13.py`, `i13_act.py` and `i13_quantity.py`
 * field-for-field, camelCased.
 *
 * These are **wire-response types only**. Every classification and aggregation
 * — aging bands, plan-vs-actual status, reclassification candidacy, exception
 * detection, reconciliation — is computed by the backend. Nothing here
 * recomputes any of it; this file only names the shapes the backend returns.
 *
 * ## Why these are not the types components render
 *
 * They were, and that was the problem. `features/initiative-13/data/live-*.ts`
 * now adapts them: `null` becomes `undefined`, decimals become numbers that stay
 * `undefined` when unknown, ISO dates become display strings, and a status the
 * backend adds tomorrow renders as a fallback instead of falling through a
 * `Record<Union, Tone>` lookup. See `lib/api/format.ts` for the primitives and
 * Initiative 8's `live-register.ts` for the pattern this follows.
 */

export type AgingBand = "FAST" | "SLOW" | "NON_MOVING"

export type ProcurementStatus = "OPEN" | "PARTIALLY_RECEIVED" | "RECEIVED"

export type LedgerUtilisationStatus = "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED"

export type LinkageStatus = "RESERVATION_LINKED" | "PR_ONLY" | "FULL_CHAIN" | "UNMATCHED"

export type AttributionStatus =
  | "RESERVATION_LINK"
  | "ORDER_LINK"
  | "PROCUREMENT_LINK"
  | "UNATTRIBUTED"

export type AcquiredVsPlanStatus = "NO_PLAN" | "BELOW_PLAN" | "ON_PLAN" | "ABOVE_PLAN"

export type I13ExceptionType = "PLAN_BREACH" | "NO_PLAN" | "GR_NOT_ISSUED_30_DAY"

export type I13ExceptionStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED"

export type SourceMode = "LIVE" | "MOCK" | "UNAVAILABLE" | string

export type MaterialScope = "OAR" | "MIN_MAX" | "EXCLUDED"

export type ActExceptionType =
  | "PLAN_BREACH"
  | "NO_PLAN"
  | "NO_PLAN_GRNI"
  | "QUANTITY_OVERRIDE"

export type ActExceptionStatus =
  | "OPEN"
  | "AWAITING_REQUESTER"
  | "CONFIRMED"
  | "ESCALATED"
  | "RESOLVED"

export type AssigneeType = "REQUESTER" | "HOD"

export type RoutingStatus =
  | "RESOLVED"
  | "ROUTING_PENDING"
  | "IDENTITY_UNRESOLVED"
  | "NOT_APPLICABLE"

/** The closed sets, as values, for `oneOf()` guards in the adapters. */
export const AGING_BANDS: readonly AgingBand[] = ["FAST", "SLOW", "NON_MOVING"]
export const PROCUREMENT_STATUSES: readonly ProcurementStatus[] = [
  "OPEN",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
]
export const LEDGER_UTILISATION_STATUSES: readonly LedgerUtilisationStatus[] = [
  "NOT_ISSUED",
  "PARTIALLY_ISSUED",
  "FULLY_ISSUED",
]
export const LINKAGE_STATUSES: readonly LinkageStatus[] = [
  "RESERVATION_LINKED",
  "PR_ONLY",
  "FULL_CHAIN",
  "UNMATCHED",
]
export const ATTRIBUTION_STATUSES: readonly AttributionStatus[] = [
  "RESERVATION_LINK",
  "ORDER_LINK",
  "PROCUREMENT_LINK",
  "UNATTRIBUTED",
]
export const ACQUIRED_VS_PLAN_STATUSES: readonly AcquiredVsPlanStatus[] = [
  "NO_PLAN",
  "BELOW_PLAN",
  "ON_PLAN",
  "ABOVE_PLAN",
]
export const ACT_EXCEPTION_TYPES: readonly ActExceptionType[] = [
  "PLAN_BREACH",
  "NO_PLAN",
  "NO_PLAN_GRNI",
  "QUANTITY_OVERRIDE",
]
export const ACT_EXCEPTION_STATUSES: readonly ActExceptionStatus[] = [
  "OPEN",
  "AWAITING_REQUESTER",
  "CONFIRMED",
  "ESCALATED",
  "RESOLVED",
]
export const ROUTING_STATUSES: readonly RoutingStatus[] = [
  "RESOLVED",
  "ROUTING_PENDING",
  "IDENTITY_UNRESOLVED",
  "NOT_APPLICABLE",
]
export const MATERIAL_SCOPES: readonly MaterialScope[] = ["OAR", "MIN_MAX", "EXCLUDED"]

export interface DataSourceStatus {
  entitySet: string
  mode: SourceMode
  rowCount: number
  available: boolean
  fetchedAt: string
}

export interface UtilisationLedgerEntry {
  ledgerId: string
  material: string
  plant: string

  reservationNumber: string | null
  reservationItem: string | null

  prNumber: string | null
  prItem: string | null

  poNumber: string | null
  poItem: string | null

  receivedQuantity: number | null
  issuedQuantity: number | null
  openQuantity: number | null

  firstGrDate: string | null
  latestGrDate: string | null
  firstGiDate: string | null
  latestGiDate: string | null

  procurementStatus: ProcurementStatus
  utilisationStatus: LedgerUtilisationStatus
  linkageStatus: LinkageStatus

  dataSource: string

  attributionStatus: AttributionStatus | null
  attributionEvidence: string | null
}

export interface WatchMetric {
  material: string
  plant: string
  materialScope: MaterialScope | null

  stockOnHand: number | null
  openPoQuantity: number | null
  averageMonthlyConsumption: number | null

  monthsOfCover: number | null
  projectedMonthsOfCover: number | null
  monthsOfCoverReason: string | null

  lastMovementDate: string | null
  daysSinceLastMovement: number | null
  lastIssueDate: string | null
  daysSinceLastIssue: number | null
  consumptionCount12m: number
  consumedQty12m: number | null
  inventoryTurns: number | null
  inventoryTurnsReason: string | null
  agingBand: AgingBand

  grNotIssuedFlag: boolean
  grNotIssuedDaysSinceGr: number | null
  grNotIssuedRelevantGrDate: string | null
  grNotIssuedThresholdDays: number
  grNotIssuedReceivedQuantity: number | null
  grNotIssuedIssuedQuantity: number | null
  grNotIssuedOutstandingQuantity: number | null

  acquiredVsPlanStatus: AcquiredVsPlanStatus
  plannedQuantity: number | null
  receivedQuantity: number | null
  issuedQuantity: number | null
  acquiredVsPlanVarianceQuantity: number | null
  acquiredVsPlanVariancePercentage: number | null

  calculatedAt: string | null
}

export interface I13Exception {
  id: string
  type: I13ExceptionType
  status: I13ExceptionStatus

  material: string
  plant: string

  reservationNumber: string | null
  prNumber: string | null
  poNumber: string | null

  ownerId: string | null
  ownerName: string | null

  createdAt: string
  dueAt: string | null
  daysOverdue: number | null

  reason: string
  evidence: string
}

export interface ReclassificationCandidate {
  material: string
  plant: string
  consumptionCount12m: number
  consumedMoreThanThreshold: boolean
  criticalImpactIndicator: boolean | null
  hodJustifiedRequestIndicator: boolean | null
  dataAvailable: boolean
  candidateFlag: boolean
  candidateReasons: string[]
}

/**
 * W6.6's ACT exception — the FR-9 queue.
 *
 * Distinct from `I13Exception` above, which is W6.3's older, ephemeral,
 * recomputed-per-request list (`/i13/exceptions`). This one is persisted, has a
 * validated state machine, an owner, a due date, an escalation path, an
 * append-only audit trail and a `sessionId`. FR-9 and FRS §9 acceptance
 * criterion 6 describe this one.
 */
export interface ActException {
  exceptionId: string
  exceptionType: ActExceptionType
  status: ActExceptionStatus

  material: string
  plant: string

  reservationNumber: string | null
  reservationItem: string | null
  sessionId: string | null
  ledgerEntryId: string | null

  ownerRequesterId: string | null

  detectedAt: string
  requesterDueAt: string | null
  escalatedAt: string | null
  resolvedAt: string | null

  currentAssigneeType: AssigneeType | null
  currentAssigneeId: string | null
  routingStatus: RoutingStatus | null

  reason: string
  evidence: Record<string, string>

  createdAt: string | null
  updatedAt: string | null
}

/** The structured requester confirmation captured on an ACT exception. */
export interface RequesterConfirmation {
  exceptionId: string
  reasonCategory: string
  freeText: string
  actorId: string
  submittedAt: string
}

/**
 * One entry in an ACT exception's append-only audit trail.
 *
 * Mirrors `ActExceptionEventResponse`. Note it carries no `exceptionId` — the
 * history is fetched per exception, so the id is the caller's context, not a
 * field on the row.
 */
export interface ActExceptionEvent {
  eventId: string | null
  eventType: string
  fromStatus: ActExceptionStatus | null
  toStatus: ActExceptionStatus | null
  actorId: string | null
  /** SYSTEM for a detection/escalation run, a person for a confirmation. */
  actorType: string
  timestamp: string
  metadata: Record<string, string>
}

export interface CrossPlantStock {
  material: string
  plant: string
  stockOnHand: number | null
}

export interface ActExceptionDetail extends ActException {
  crossPlantStock: CrossPlantStock[]
  confirmation: RequesterConfirmation | null
}

/**
 * One requester justification, flattened from an `ActExceptionDetail`'s
 * `confirmation` for the Justification Log — see `getI13Justifications` for how
 * it is assembled (there is no bulk confirmation-listing endpoint).
 */
export interface JustificationEntry {
  exceptionId: string
  exceptionType: ActExceptionType
  material: string
  plant: string
  ownerRequesterId: string | null
  reasonCategory: string
  freeText: string
  actorId: string
  submittedAt: string
}

/**
 * FR-4's consumption plan, as captured through the assistant.
 *
 * `POST /api/i13/consumption-plans` writes one; this is what comes back.
 * Quantities are strings on the wire and stay strings until an adapter parses
 * them — a Decimal through a JSON float is not the number that was recorded.
 */
export interface ConsumptionPlan {
  id: string
  /**
   * The assistant session this plan was captured in.
   *
   * FR-4 stores a plan *against* a session identifier, and with the reservation
   * link blocked on `RESB.BEDNR` this is currently the only link a plan has to
   * anything else.
   */
  sessionId: string
  material: string
  plant: string
  purpose: string
  plannedQuantity: string
  windowStart: string | null
  windowEnd: string | null
  costCentre: string | null
  orderNumber: string | null
  status: string
  reservationNumber: string | null
  reservationItem: string | null
  capturedBy: string
  capturedAt: string
}

/** FR-3's answer, computed on demand for one material, plant and quantity. */
export interface QuantitySuggestion {
  material: string
  plant: string
  requestedQuantity: string
  /** Null when no suggestion could be made — **not zero**. `available` says which. */
  suggestedQuantity: string | null
  available: boolean
  isOverride: boolean
  reason: string
  noSuggestionReason: string | null
  stockOnHand: string | null
  openPoQuantity: string
  averageMonthlyConsumption: string
  monthsOfCover: string | null
  projectedCoverIfSuggested: string | null
  projectedCoverIfRequested: string | null
  consumptionCount: number
  coverCeilingMonths: string
  lookbackMonths: number
  minHistoryConsumptions: number
  basisNote: string
}

/** W6.4 — who owns the consumption recorded against a reservation line. */
export interface ConsumptionAttribution {
  ledgerId: string
  material: string
  plant: string
  reservationNumber: string
  reservationItem: string
  requesterId: string | null
  orderNumber: string | null
  costCentre: string | null
  status: string
  source: string
  evidence: string
  costCentreAttributionEnabled: boolean
  attributedAt: string
}

export interface ReconciliationSourceResult {
  sourceName: string
  computedCount: number
  referenceCount: number | null
  absoluteDifference: number | null
  percentageDifference: number | null
  withinTolerance: boolean | null
  status: string
}

export interface ValidationResult {
  tolerancePct: number
  results: ReconciliationSourceResult[]
}

export interface I13Summary {
  totalOarPositions: number
  fastMovingCount: number
  slowMovingCount: number
  nonMovingCount: number
  grNotIssued30DayCount: number
  planBreachCount: number
  noPlanCount: number
  reclassificationCandidateCount: number
  valuationIsMocked: boolean
}

/**
 * `GET /i13/grni` — one reservation-ledger entry received and not issued for at
 * least the GR-not-issued threshold (FRS FR-6). The per-entry form of WATCH's
 * `grNotIssuedFlag`, which is per material and plant.
 */
export interface GrniEntry {
  ledgerId: string
  reservationNumber: string
  reservationItem: string
  material: string
  plant: string
  materialScope: MaterialScope
  prNumber: string | null
  poNumber: string | null
  poItem: string | null
  receivedQuantity: number
  issuedQuantity: number
  outstandingQuantity: number
  firstGrDate: string | null
  lastGrDate: string
  daysSinceGr: number
  thresholdDays: number
  requirementDate: string | null
  lifecycleStatus: string
}

/** One month of net goods issues and receipts for one material and plant. */
export interface MonthlyConsumption {
  /** `YYYY-MM`. */
  month: string
  issuedQuantity: number
  issueCount: number
  receivedQuantity: number
}

/**
 * `GET /i13/usage-patterns` — month-by-month usage for one material and plant.
 * `months` covers every month of the delivered history, zero months included,
 * so a gap in consumption shows as a gap.
 */
export interface UsagePattern {
  material: string
  plant: string
  materialScope: MaterialScope
  agingBand: AgingBand | null
  stockOnHand: number | null
  averageMonthlyConsumption: number | null
  monthsOfCover: number | null
  issuedQuantityTotal: number
  issueCountTotal: number
  activeMonths: number
  lastIssueMonth: string | null
  months: MonthlyConsumption[]
}

/** `GET /i13/snapshot` — what the OAR screens are being served from. */
export interface I13SnapshotStatus {
  status: "idle" | "building" | "ready" | "failed" | string
  enabled: boolean
  version: number | null
  referenceDate: string | null
  builtAt: string | null
  buildSeconds: number | null
  buildingSince: string | null
  rebuilding: boolean
  lastError: string | null
}
