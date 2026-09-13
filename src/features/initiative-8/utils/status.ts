import type {
  AgingBucket,
  DeclarationStatus,
  ReceiptStatus,
  RepairChain,
  RepairStatus,
} from "@/features/initiative-8/types/repair"

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

/** Placeholder for a value the source data does not carry. */
export const UNKNOWN = "—"

/**
 * Is this repair late?
 *
 * The one place that question is answered, because there are two ways to get
 * it wrong and both are silent.
 *
 * The first: `chain.daysRemainingInRepair < 0`. That field is optional now,
 * and `undefined < 0` evaluates to `false` — so a line with no agreed return
 * date reads as comfortably on time. Those are exactly the lines nobody is
 * chasing, and there are 63 of them in the July extract.
 *
 * The second: treating a closed repair as overdue because its date has passed.
 * It came back; the date no longer matters.
 *
 * `overdueStatus` from the backend is authoritative when present. The fallback
 * keeps the scenario fixtures working, which still carry a date on every row.
 */
export function isRepairOverdue(chain: RepairChain): boolean {
  if (chain.overdueStatus) return chain.overdueStatus === "OVERDUE"
  if (chain.repairStatus === "Closed" || chain.receivedAt) return false
  return chain.daysRemainingInRepair !== undefined && chain.daysRemainingInRepair < 0
}

/** True when no return date was ever agreed — its own state, not "on time". */
export function hasNoDueDate(chain: RepairChain): boolean {
  if (chain.overdueStatus) return chain.overdueStatus === "NO_DUE_DATE"
  return chain.expectedReturn === undefined
}

/**
 * "7 days remaining", "12 days overdue", or an explanation of why neither.
 *
 * An explicit day count wins over everything else. Checking `hasNoDueDate`
 * first looks tidier and is wrong: a caller holding a real number would be
 * told no date was agreed, purely because it had not also passed the formatted
 * date alongside it.
 */
export function formatDaysRemaining(chain: RepairChain): string {
  const days = chain.daysRemainingInRepair
  if (days !== undefined) {
    return days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`
  }
  if (hasNoDueDate(chain)) return "No return date agreed"
  return UNKNOWN
}

/** The vendor to show: its name when known, else its code, else a placeholder. */
export function vendorLabel(chain: RepairChain): string {
  return chain.vendorName ?? chain.vendor ?? "Unknown vendor"
}

/** A number for display, or a placeholder when the source does not carry one. */
export function orUnknown(value: number | string | undefined): string {
  return value === undefined ? UNKNOWN : String(value)
}
