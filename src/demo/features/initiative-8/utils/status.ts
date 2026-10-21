import type {
  AgingBucket,
  CodingTextSource,
  DeclarationCondition,
  DeclarationStatus,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  LeadTimeStatus,
  LifecycleStage,
  OverdueStatus,
  ReceiptStatus,
  RepairChain,
  RepairStatus,
  RepairableUnitBasis,
  SessionLinkStatus,
  SessionOutcome,
} from "@demo/features/initiative-8/types/repair"

/** Labels and tones for every Initiative 8 status — one place, every screen. */

export type Tone = "default" | "success" | "warning" | "danger"

/** Placeholder for a value the data does not carry. */
export const UNKNOWN = "—"

// ---------------------------------------------------------------------------
// Repair lines
// ---------------------------------------------------------------------------

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  Received: "success",
  Closed: "success",
  Scrapped: "danger",
}

export const REPAIR_STATUS_ORDER: readonly RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "Received",
  "Closed",
  "Scrapped",
]

/** Shown as a mark on the repair status rather than as its own column. */
export function isPartiallyReceived(chain: { receiptStatus: ReceiptStatus }): boolean {
  return chain.receiptStatus === "Partially Received"
}

/** The FRS's lifecycle stages (FR-3), as the timeline and filters name them. */
export const STAGE_LABEL: Record<LifecycleStage, string> = {
  REMOVED: "Removed",
  ATTESTED: "Attested",
  PR_RAISED: "Repair PR raised",
  PO_ISSUED: "Repair PO issued",
  AT_VENDOR: "At vendor",
  RETURNED: "Returned",
  BACK_IN_STOCK: "Back in stock",
  SCRAPPED: "Scrapped",
}

export const STAGE_ORDER: readonly LifecycleStage[] = [
  "REMOVED",
  "ATTESTED",
  "PR_RAISED",
  "PO_ISSUED",
  "AT_VENDOR",
  "RETURNED",
  "BACK_IN_STOCK",
  "SCRAPPED",
]

export const AGING_BUCKETS: AgingBucket[] = ["0-15", "16-30", "31-45", "46-60", "60+"]

export const OVERDUE_STATUSES: readonly OverdueStatus[] = [
  "OVERDUE",
  "ON_TIME",
  "NO_DUE_DATE",
  "RECEIVED",
  "SCRAPPED",
]

export const OVERDUE_STATUS_LABEL: Record<OverdueStatus, string> = {
  OVERDUE: "Overdue",
  ON_TIME: "On time",
  NO_DUE_DATE: "No due date",
  RECEIVED: "Received",
  SCRAPPED: "Scrapped",
}

export const OVERDUE_STATUS_TONE: Record<OverdueStatus, Tone> = {
  OVERDUE: "danger",
  ON_TIME: "default",
  NO_DUE_DATE: "warning",
  RECEIVED: "success",
  SCRAPPED: "default",
}

export function overdueStatusOf(chain: Pick<RepairChain, "overdueStatus">): OverdueStatus {
  return chain.overdueStatus
}

export function isRepairOverdue(chain: Pick<RepairChain, "overdueStatus">): boolean {
  return chain.overdueStatus === "OVERDUE"
}

/** Still out: not received in full and not scrapped. */
export function isOpenRepair(chain: Pick<RepairChain, "overdueStatus">): boolean {
  return chain.overdueStatus !== "RECEIVED" && chain.overdueStatus !== "SCRAPPED"
}

/** "7 days remaining", "12 days overdue", or "no due date". */
export function formatDaysRemaining(chain: Pick<RepairChain, "daysRemainingInRepair">): string {
  const days = chain.daysRemainingInRepair
  if (days === undefined) return "no due date"
  return days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days past due`
}

/** `NO_LEAD_TIME` is the absence of a verdict, rendered as a dash, never a badge. */
export type LeadTimeVerdict = Exclude<LeadTimeStatus, "NO_LEAD_TIME">

export const LEAD_TIME_VERDICT_LABEL: Record<LeadTimeVerdict, string> = {
  BEYOND_LEAD_TIME: "Beyond",
  WITHIN_LEAD_TIME: "Within",
}

export const LEAD_TIME_VERDICT_TONE: Record<LeadTimeVerdict, Tone> = {
  BEYOND_LEAD_TIME: "warning",
  WITHIN_LEAD_TIME: "default",
}

export function isBeyondLeadTime(chain: Pick<RepairChain, "leadTimeStatus">): boolean {
  return chain.leadTimeStatus === "BEYOND_LEAD_TIME"
}

export function hasNoLeadTime(chain: Pick<RepairChain, "leadTimeStatus">): boolean {
  return chain.leadTimeStatus === undefined || chain.leadTimeStatus === "NO_LEAD_TIME"
}

export const CRITICALITY_TONE: Record<string, Tone> = {
  CRITICAL: "danger",
  IMPACT: "warning",
  INSURANCE: "warning",
  NORMAL: "default",
  OBSOLETE: "default",
}

/** Filter/CSV label for a line with no criticality rating on record. */
export const NO_CRITICALITY = "Not recorded"

// ---------------------------------------------------------------------------
// Declarations (FR-4)
// ---------------------------------------------------------------------------

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Completed: "success",
  Flagged: "danger",
}

export const DECLARATION_STATUSES: readonly DeclarationStatus[] = ["Required", "Completed", "Flagged"]

export const DECLARATION_CONDITIONS: readonly DeclarationCondition[] = [
  "Repairable",
  "Beyond Economical Repair",
  "Scrap",
]

export const DECLARATION_CONDITION_TONE: Record<DeclarationCondition, Tone> = {
  Repairable: "success",
  "Beyond Economical Repair": "warning",
  Scrap: "danger",
}

/** A coded value as words: `BEARING_FAILURE` -> "bearing failure". */
export function codeLabel(code: string | undefined): string {
  return code ? code.replace(/_/g, " ").toLowerCase() : UNKNOWN
}

// ---------------------------------------------------------------------------
// Justifications (FR-7)
// ---------------------------------------------------------------------------

/**
 * What the register's Justification cell says. `NOT_ASKED` is a MISSING whose
 * every unjustified purchase predates the justification control. `NONE` is a
 * line no reason and no new purchase ever touched.
 */
export type JustificationCell = "RECORDED" | "MISSING" | "NOT_ASKED" | "NONE"

export function justificationCellOf(chain: Pick<RepairChain, "justification">): JustificationCell {
  const value = chain.justification
  if (!value) return "NONE"
  if (value.status === "RECORDED") return "RECORDED"
  return value.unjustifiedPurchases.length > 0 &&
    value.unjustifiedPurchases.every((purchase) => purchase.preAutomation)
    ? "NOT_ASKED"
    : "MISSING"
}

export const JUSTIFICATION_CELL_LABEL: Record<JustificationCell, string> = {
  RECORDED: "Recorded",
  MISSING: "Missing",
  NOT_ASKED: "Not asked",
  NONE: "—",
}

export const JUSTIFICATION_CELL_TONE: Record<Exclude<JustificationCell, "NONE">, Tone> = {
  RECORDED: "success",
  MISSING: "warning",
  NOT_ASKED: "default",
}

export const JUSTIFICATION_CELL_NOTE: Record<JustificationCell, string> = {
  RECORDED: "A reason for buying new was recorded while this repair was out.",
  MISSING: "A new unit was bought while this repair was out, and no reason was recorded.",
  NOT_ASKED:
    "A new unit was bought while this repair was out, before the justification control existed — nobody was asked.",
  NONE: "No new unit was bought, and no reason recorded, while this repair was out.",
}

export const JUSTIFICATION_SOURCE_LABEL = {
  ASSISTANT: "At reservation time",
  EXCEPTION: "Chasing an exception",
} as const

// ---------------------------------------------------------------------------
// The repairable-unit rule (FR-6) and sessions (FR-5, FR-8)
// ---------------------------------------------------------------------------

export const BASIS_LABEL: Record<RepairableUnitBasis, string> = {
  STOCK: "Stock on hand",
  OPEN_REPAIR: "Open repair",
  AT_VENDOR_NO_PO: "At vendor, no PO",
}

export const SESSION_LINK_LABEL: Record<SessionLinkStatus, string> = {
  VALID: "Valid session",
  MISSING: "No session ID",
  UNKNOWN_SESSION: "Unknown session ID",
  OTHER_PART: "Another part's session",
}

export const SESSION_LINK_TONE: Record<SessionLinkStatus, Tone> = {
  VALID: "success",
  MISSING: "danger",
  UNKNOWN_SESSION: "warning",
  OTHER_PART: "warning",
}

export const SESSION_OUTCOME_LABEL: Record<SessionOutcome, string> = {
  CHOSE_REPAIR: "Chose repair",
  BOUGHT_NEW: "Bought new (justified)",
  NO_REPAIRABLE_UNIT: "No repairable unit",
  ABANDONED: "Abandoned",
}

// ---------------------------------------------------------------------------
// Exception queue (FR-8, FR-9, FR-11)
// ---------------------------------------------------------------------------

export const EXCEPTION_TYPES: readonly ExceptionType[] = [
  "OVERDUE_REPAIR",
  "MISSING_ATTESTATION",
  "MISSING_SESSION_ID",
  "UNJUSTIFIED_ACQUISITION",
]

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  OVERDUE_REPAIR: "Overdue repair",
  MISSING_ATTESTATION: "Missing attestation",
  MISSING_SESSION_ID: "Missing session ID",
  UNJUSTIFIED_ACQUISITION: "Unjustified acquisition",
}

/** A readable label for an exception type, humanised from its code when unknown. */
export function exceptionTypeLabel(type: string): string {
  const known = EXCEPTION_TYPE_LABELS[type]
  if (known) return known
  const words = type.replace(/_/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : UNKNOWN
}

export const EXCEPTION_SEVERITY_TONE: Record<ExceptionSeverity, Tone> = {
  critical: "danger",
  warning: "warning",
  info: "default",
}

export const EXCEPTION_STATUSES: readonly ExceptionStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

export const EXCEPTION_STATUS_LABEL: Record<ExceptionStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

export const EXCEPTION_STATUS_TONE: Record<ExceptionStatus, Tone> = {
  OPEN: "danger",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "default",
}

/** Still being worked: Open or In progress. */
export function isOpenException(exception: { status: ExceptionStatus }): boolean {
  return exception.status === "OPEN" || exception.status === "IN_PROGRESS"
}

// ---------------------------------------------------------------------------
// Coding candidates (FR-2)
// ---------------------------------------------------------------------------

export const CODING_VERDICTS = [
  "MISCODED_REPAIRABLE",
  "UNCLEAR",
  "REPAIR_SERVICE",
  "CONSUMABLE_FOR_REPAIR",
]

export const CODING_VERDICT_TONE: Record<string, Tone> = {
  MISCODED_REPAIRABLE: "danger",
  UNCLEAR: "warning",
  REPAIR_SERVICE: "success",
  CONSUMABLE_FOR_REPAIR: "success",
}

export const CODING_CONFIDENCE_TONE: Record<string, Tone> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

export const CODING_SOURCE_LABEL: Record<CodingTextSource, string> = {
  PR: "PR text",
  PO: "PO text",
  MOVEMENT: "Movement text",
}
