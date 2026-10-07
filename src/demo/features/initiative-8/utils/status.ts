import type {
  AgingBucket,
  DeclarationStatus,
  ExceptionSeverity,
  ReceiptStatus,
  RepairStatus,
} from "@demo/features/initiative-8/types/repair"

type Tone = "default" | "success" | "warning" | "danger"

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  "In Transit Return": "warning",
  Received: "success",
  Closed: "success",
}

export const RECEIPT_STATUS_TONE: Record<ReceiptStatus, Tone> = {
  "Not Yet Shipped": "default",
  "Awaiting Receipt": "warning",
  "Partially Received": "warning",
  Received: "success",
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Pending: "default",
  Completed: "success",
  Flagged: "danger",
}

export const AGING_BUCKETS: AgingBucket[] = ["0-15", "16-30", "31-45", "46-60", "60+"]

export function agingBucketForDays(days: number): AgingBucket {
  if (days <= 15) return "0-15"
  if (days <= 30) return "16-30"
  if (days <= 45) return "31-45"
  if (days <= 60) return "46-60"
  return "60+"
}

export const EXCEPTION_SEVERITY_TONE: Record<ExceptionSeverity, Tone> = {
  info: "default",
  warning: "warning",
  critical: "danger",
}

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  MISSING_ATTESTATION: "Missing attestation",
  UNJUSTIFIED_ACQUISITION: "Unjustified acquisition",
}

/**
 * A readable label for an exception type. Falls back to title-casing the raw
 * code rather than returning nothing, so a check added later still reads as a
 * sentence instead of a constant.
 */
export function exceptionTypeLabel(type: string): string {
  return (
    EXCEPTION_TYPE_LABELS[type] ??
    type
      .toLowerCase()
      .split("_")
      .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(" ")
  )
}

export const CODING_VERDICT_TONE: Record<string, Tone> = {
  MISCODED_REPAIRABLE: "danger",
  UNCLEAR: "warning",
  REPAIR_SERVICE: "default",
  CONSUMABLE_FOR_REPAIR: "default",
}

export const CODING_CONFIDENCE_TONE: Record<string, Tone> = {
  high: "success",
  medium: "warning",
  low: "default",
}

/** What a missing value reads as. Never a blank cell, never a zero. */
export const UNKNOWN = "Not known"
