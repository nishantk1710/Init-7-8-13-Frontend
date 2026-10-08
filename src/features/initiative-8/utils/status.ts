import type {
  AgingBucket,
  DeclarationStatus,
  ExceptionSeverity,
  LeadTimeStatus,
  OverdueStatus,
  ReceiptStatus,
  RepairChain,
  RepairStatus,
} from "@/features/initiative-8/types/repair"

type Tone = "default" | "success" | "warning" | "danger"

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  Received: "success",
  Closed: "success",
}

/**
 * True when some, but not all, of the line has come back.
 *
 * The one thing the receipt status says that the repair status does not —
 * the other three values map one-to-one onto PO Issued, At Vendor and
 * Received — so it is shown as a mark on the repair status rather than as a
 * second status column.
 */
export function isPartiallyReceived(chain: { receiptStatus: ReceiptStatus }): boolean {
  return chain.receiptStatus === "Partially Received"
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Completed: "success",
  Flagged: "danger",
}

/** The declaration statuses, in the order the filters offer them. */
export const DECLARATION_STATUSES: readonly DeclarationStatus[] = [
  "Required",
  "Completed",
  "Flagged",
]

/** The lifecycle order, for sorting status options that come from the data. */
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

/**
 * NO_DUE_DATE is a warning, not a neutral: nobody agreed a return date, and
 * those are exactly the lines nobody is chasing.
 */
export const OVERDUE_STATUS_TONE: Record<OverdueStatus, Tone> = {
  OVERDUE: "danger",
  ON_TIME: "default",
  NO_DUE_DATE: "warning",
  RECEIVED: "success",
}

/**
 * The lead-time states that carry an actual verdict.
 *
 * `NO_LEAD_TIME` is deliberately excluded. It is not a third verdict — it is
 * the absence of one, and the register renders it as a muted placeholder
 * rather than a badge for the same reason the criticality column does: a badge
 * beside two real verdicts reads as a third, and "we were never told how long
 * this takes" must not look like a finding of any kind.
 */
export type LeadTimeVerdict = Exclude<LeadTimeStatus, "NO_LEAD_TIME">

export const LEAD_TIME_VERDICT_LABEL: Record<LeadTimeVerdict, string> = {
  BEYOND_LEAD_TIME: "Beyond",
  WITHIN_LEAD_TIME: "Within",
}

/**
 * Verdict -> tone. "Beyond" is a warning and never a danger: the benchmark is
 * `MARC.PLIFZ`, a planned delivery time for procuring the material, and a line
 * past it has overrun a reference figure rather than broken a commitment
 * anybody made. The promised date is the Due Date Status column's job.
 */
export const LEAD_TIME_VERDICT_TONE: Record<LeadTimeVerdict, Tone> = {
  BEYOND_LEAD_TIME: "warning",
  WITHIN_LEAD_TIME: "default",
}

/**
 * ZMM065 criticality -> tone. Keyed by string, not a closed union: the ratings
 * are the backend's vocabulary, and an unrecognised one falls back to
 * "default" rather than failing a lookup.
 */
export const CRITICALITY_TONE: Record<string, Tone> = {
  CRITICAL: "danger",
  IMPACT: "warning",
  INSURANCE: "warning",
  NORMAL: "default",
  OBSOLETE: "default",
}

/** Filter/CSV label for a line with no criticality rating on record. */
export const NO_CRITICALITY = "Not recorded"

export const EXCEPTION_SEVERITY_TONE: Record<ExceptionSeverity, Tone> = {
  critical: "danger",
  warning: "warning",
  info: "default",
}

const EXCEPTION_TYPE_LABEL: Record<string, string> = {
  MISSING_ATTESTATION: "Missing attestation",
  UNJUSTIFIED_ACQUISITION: "Unjustified acquisition",
}

/**
 * A readable label for an exception type — including one this build has never
 * heard of, which is humanised from its code ("SOME_NEW_CHECK" -> "Some new
 * check") rather than shown raw or dropped.
 */
export function exceptionTypeLabel(type: string): string {
  const known = EXCEPTION_TYPE_LABEL[type]
  if (known) return known
  const words = type.replace(/_/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : UNKNOWN
}

/**
 * The bands rendered before either side could read them from configuration.
 *
 * Used as the fallback in `scenario` mode (no backend to ask) and if a live
 * snapshot fetch fails — never as the source of truth when live data is
 * available. See `GET /api/i8/snapshot`'s `rules.agingBands`.
 */
export const DEFAULT_AGING_BUCKETS: AgingBucket[] = ["0-15", "16-30", "31-45", "46-60", "60+"]

/**
 * Verdict -> tone for the coding-candidates screen.
 *
 * Not a `Record<Verdict, Tone>` over a closed union: the verdict vocabulary
 * (`MISCODED_REPAIRABLE`, `REPAIR_SERVICE`, `CONSUMABLE_FOR_REPAIR`,
 * `UNCLEAR`, `UNSCREENED`) is an implementation decision on the backend, not
 * an FRS-specified set — see `app/initiatives/i8/coding_candidates.py`. An
 * unrecognised verdict falls back to `"default"` rather than a type error.
 */
export const CODING_VERDICT_TONE: Record<string, Tone> = {
  MISCODED_REPAIRABLE: "danger",
  UNCLEAR: "warning",
  REPAIR_SERVICE: "success",
  CONSUMABLE_FOR_REPAIR: "success",
  UNSCREENED: "default",
}

/**
 * Confidence -> tone, for the same screen. Independent of verdict tone: this
 * says how much to trust the row, not what the row found. Empty
 * (unscreened) falls back to "default".
 */
export const CODING_CONFIDENCE_TONE: Record<string, Tone> = {
  high: "success",
  medium: "warning",
  low: "danger",
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
 * The line's overdue status for a badge or a filter. The backend's answer when
 * it sent one; otherwise derived through the same helpers as above, received
 * first, so a unit that came back is never shown as late.
 */
export function overdueStatusOf(chain: RepairChain): OverdueStatus {
  if (chain.overdueStatus) return chain.overdueStatus
  if (chain.repairStatus === "Closed" || chain.receivedAt) return "RECEIVED"
  if (isRepairOverdue(chain)) return "OVERDUE"
  return hasNoDueDate(chain) ? "NO_DUE_DATE" : "ON_TIME"
}

/**
 * Still out: the unit has not come back. The same test the register's
 * `openLines` count uses, so a chart built on it agrees with the KPI beside
 * it. Not `repairStatus !== "Closed"` — a line can read "Received" without
 * being closed, and it is back all the same.
 */
export function isOpenRepair(chain: RepairChain): boolean {
  return overdueStatusOf(chain) !== "RECEIVED"
}

/**
 * True when this line has run past its material's planned delivery time.
 *
 * Deliberately NOT folded into `isRepairOverdue()`. They answer different
 * questions — the promised date versus the normal turnaround — and a row can
 * be on time by one and beyond by the other. Merging them would collapse that
 * disagreement into a single verdict and lose the finding.
 *
 * No fallback arithmetic here, unlike `isRepairOverdue()`. The benchmark is
 * `MARC.PLIFZ` and only the backend has it: the scenario fixtures carry no
 * lead time, so a line with no `leadTimeStatus` is unknown, not compliant.
 */
export function isBeyondLeadTime(chain: RepairChain): boolean {
  return chain.leadTimeStatus === "BEYOND_LEAD_TIME"
}

/**
 * True when there is no planned delivery time to judge this line against.
 *
 * Its own state, the same way `hasNoDueDate` is — and a populous one: MARC
 * has rows for plant 1300 only, so all 357 Gamsberg lines land here. Render
 * it as "not known" and never as "within".
 */
export function hasNoLeadTime(chain: RepairChain): boolean {
  return chain.leadTimeStatus === undefined || chain.leadTimeStatus === "NO_LEAD_TIME"
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
