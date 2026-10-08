import type {
  AgingBucket,
  DeclarationStatus,
  ExceptionSeverity,
  LeadTimeStatus,
  OverdueStatus,
  ReceiptStatus,
  RepairChain,
  RepairStatus,
} from "@demo/features/initiative-8/types/repair"

type Tone = "default" | "success" | "warning" | "danger"

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  Received: "success",
  Closed: "success",
}

/** Shown as a mark on the repair status rather than as its own column. */
export function isPartiallyReceived(chain: { receiptStatus: ReceiptStatus }): boolean {
  return chain.receiptStatus === "Partially Received"
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Completed: "success",
  Flagged: "danger",
}

export const DECLARATION_STATUSES: readonly DeclarationStatus[] = [
  "Required",
  "Completed",
  "Flagged",
]

export const REPAIR_STATUS_ORDER: readonly RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "Received",
  "Closed",
]

export const OVERDUE_STATUSES: readonly OverdueStatus[] = [
  "OVERDUE",
  "ON_TIME",
  "NO_DUE_DATE",
  "RECEIVED",
]

export const OVERDUE_STATUS_LABEL: Record<OverdueStatus, string> = {
  OVERDUE: "Overdue",
  ON_TIME: "On time",
  NO_DUE_DATE: "No due date",
  RECEIVED: "Received",
}

export const OVERDUE_STATUS_TONE: Record<OverdueStatus, Tone> = {
  OVERDUE: "danger",
  ON_TIME: "default",
  NO_DUE_DATE: "warning",
  RECEIVED: "success",
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

export const CRITICALITY_TONE: Record<string, Tone> = {
  CRITICAL: "danger",
  IMPACT: "warning",
  INSURANCE: "warning",
  NORMAL: "default",
  OBSOLETE: "default",
}

/** Filter/CSV label for a line with no criticality rating on record. */
export const NO_CRITICALITY = "Not recorded"

export const AGING_BUCKETS: AgingBucket[] = ["0-15", "16-30", "31-45", "46-60", "60+"]

export const EXCEPTION_SEVERITY_TONE: Record<ExceptionSeverity, Tone> = {
  critical: "danger",
  warning: "warning",
  info: "default",
}

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  MISSING_ATTESTATION: "Missing attestation",
  UNJUSTIFIED_ACQUISITION: "Unjustified acquisition",
}

/** A readable label for an exception type, humanised from its code when unknown. */
export function exceptionTypeLabel(type: string): string {
  const known = EXCEPTION_TYPE_LABELS[type]
  if (known) return known
  const words = type.replace(/_/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : UNKNOWN
}

export const CODING_VERDICT_TONE: Record<string, Tone> = {
  MISCODED_REPAIRABLE: "danger",
  UNCLEAR: "warning",
  REPAIR_SERVICE: "success",
  CONSUMABLE_FOR_REPAIR: "success",
  UNSCREENED: "default",
}

export const CODING_CONFIDENCE_TONE: Record<string, Tone> = {
  high: "success",
  medium: "warning",
  low: "danger",
}

/** Placeholder for a value the data does not carry. */
export const UNKNOWN = "—"

export function isRepairOverdue(chain: RepairChain): boolean {
  if (chain.repairStatus === "Closed" || chain.receivedAt) return false
  return chain.daysRemainingInRepair < 0
}

export function overdueStatusOf(chain: RepairChain): OverdueStatus {
  if (chain.repairStatus === "Closed" || chain.receivedAt) return "RECEIVED"
  if (isRepairOverdue(chain)) return "OVERDUE"
  return chain.expectedReturn ? "ON_TIME" : "NO_DUE_DATE"
}

/** Still out: the unit has not come back. The same test the open-lines count uses. */
export function isOpenRepair(chain: RepairChain): boolean {
  return overdueStatusOf(chain) !== "RECEIVED"
}

export function isBeyondLeadTime(chain: RepairChain): boolean {
  return chain.leadTimeStatus === "BEYOND_LEAD_TIME"
}

export function hasNoLeadTime(chain: RepairChain): boolean {
  return chain.leadTimeStatus === undefined || chain.leadTimeStatus === "NO_LEAD_TIME"
}

/** "7 days remaining" or "12 days overdue". */
export function formatDaysRemaining(chain: RepairChain): string {
  const days = chain.daysRemainingInRepair
  return days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`
}
