// Initiative 13 — typed contracts for `GET /api/i13/*`, mirroring
// `Init-7-8-13-Backend/app/schemas/i13.py` field-for-field (camelCased).
//
// These are wire-response types only. All classification/aggregation
// (aging bands, plan-vs-actual status, reclassification candidacy, exception
// detection, reconciliation) is computed by the backend — nothing here
// recomputes it, this file only names the shapes the backend already returns.

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

  receivedQuantity: number
  issuedQuantity: number
  openQuantity: number

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

  monthsOfCover: number | null
  monthsOfCoverReason: string | null

  daysSinceLastMovement: number | null
  consumptionCount12m: number
  consumedQty12m: number
  inventoryTurns: number | null
  inventoryTurnsReason: string | null
  agingBand: AgingBand

  grNotIssuedFlag: boolean
  grNotIssuedDaysSinceGr: number | null
  grNotIssuedReceivedQuantity: number
  grNotIssuedIssuedQuantity: number
  grNotIssuedOutstandingQuantity: number

  acquiredVsPlanStatus: AcquiredVsPlanStatus
  plannedQuantity: number | null
  receivedQuantity: number
  issuedQuantity: number
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
