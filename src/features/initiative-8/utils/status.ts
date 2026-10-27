import type {
  AgingBucket,
  DeclarationStatus,
  ExceptionStatus,
  LeadTimeStatus,
  OverdueStatus,
  RepairChain,
  RepairStatus,
  UnjustifiedPurchase,
} from "@/features/initiative-8/types/repair"

type Tone = "default" | "success" | "warning" | "danger"

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  "PR Raised": "default",
  "PO Issued": "default",
  "At Vendor": "warning",
  Received: "success",
  Closed: "success",
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, Tone> = {
  Required: "warning",
  Completed: "success",
  Flagged: "danger",
  Historical: "default",
}

/** The declaration statuses, in the order the filters offer them. */
export const DECLARATION_STATUSES: readonly DeclarationStatus[] = [
  "Required",
  "Completed",
  "Flagged",
  "Historical",
]

/**
 * What the register's Justification cell says.
 *
 * `NOT_ASKED` is a MISSING whose every unjustified purchase predates the
 * justification control — the same pre-automation split the exception check
 * makes, so a purchase nobody could have been asked about does not read as a
 * miss. `NONE` is a line no reason and no new purchase ever touched.
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

/** The hover text behind each cell — what it means, in a sentence. Since
 *  27-Oct-2026 the check looks at the request for a new unit (the new-buy PR)
 *  as well as a PO ordered directly, so the notes say "requested or bought". */
export const JUSTIFICATION_CELL_NOTE: Record<JustificationCell, string> = {
  RECORDED: "A reason for buying new was recorded while this repair was out.",
  MISSING:
    "A new unit was requested or bought while this repair was out, and no reason was recorded.",
  NOT_ASKED:
    "A new unit was requested or bought while this repair was out, before the justification control existed — nobody was asked.",
  NONE: "No new unit was requested or bought, and no reason recorded, while this repair was out.",
}

/**
 * One purchase made while a repair was out, as the repair detail page lists
 * it. A new-buy PR is a request for a unit, not a purchase yet, so it reads
 * "New unit requested {date} (PR {n}/{item})"; a PO ordered directly keeps
 * "{n}/{item} bought {date}". `raisedAt` is already a display date.
 */
export function purchaseSummary(
  purchase: Pick<UnjustifiedPurchase, "purchase" | "raisedAt">,
): string {
  const { documentNumber, line } = purchase.purchase
  const document = line ? `${documentNumber}/${line}` : documentNumber
  const when = purchase.raisedAt ?? "on an unknown date"
  return purchase.purchase.type === "PR"
    ? `New unit requested ${when} (PR ${document})`
    : `${document} bought ${when}`
}

/** The exception drawer's name for the purchase an item is about. */
export function purchaseFactLabel(type: string | undefined): string {
  return type === "PR" ? "Purchase request" : "Purchase line"
}

/** The lifecycle order, for sorting status options that come from the data. */
export const REPAIR_STATUS_ORDER: readonly RepairStatus[] = [
  "PR Raised",
  "PO Issued",
  "At Vendor",
  "Received",
  "Closed",
]

/** What the register's due-date filter offers. No RECEIVED: every line the
 *  register serves is open in SAP, so it could only ever find nothing.
 *  NOT_ORDERED finds the repair PRs with no PO yet; on a backend that does
 *  not serve them it finds nothing, the same as any filter with no match. */
export const OVERDUE_STATUSES: readonly OverdueStatus[] = [
  "OVERDUE",
  "ON_TIME",
  "NO_DUE_DATE",
  "NOT_ORDERED",
]

export const OVERDUE_STATUS_LABEL: Record<OverdueStatus, string> = {
  OVERDUE: "Overdue",
  ON_TIME: "On time",
  NO_DUE_DATE: "No due date",
  RECEIVED: "Received",
  NOT_ORDERED: "No PO yet",
}

/**
 * NO_DUE_DATE is a warning, not a neutral: nobody agreed a return date, and
 * those are exactly the lines nobody is chasing. NOT_ORDERED is muted: with
 * no PO there is no date anybody could have agreed, so it is not a finding.
 */
export const OVERDUE_STATUS_TONE: Record<OverdueStatus, Tone> = {
  OVERDUE: "danger",
  ON_TIME: "default",
  NO_DUE_DATE: "warning",
  RECEIVED: "success",
  NOT_ORDERED: "default",
}

/**
 * Is this register row a repair requested on a PR with no PO yet?
 *
 * Fails closed: a row the backend marked `PR`, OR any row with no PO
 * reference, counts as one -- so a screen that must not offer a PO-only action
 * (declare, chase the vendor) never offers it on a row it cannot place on a
 * PO. On an older backend every row has a PO, so nothing changes there.
 */
export function isPrOnly(chain: Pick<RepairChain, "lineKind" | "repairPO">): boolean {
  return chain.lineKind === "PR" || chain.repairPO === undefined
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
 * Still out: the unit has not come back. Every line the register serves is --
 * it lists only lines SAP still has open. Not `repairStatus !== "Closed"`: a
 * line can read "Received" without being closed, and it is back all the same.
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

/**
 * The bucket a line with no vendor at all falls into.
 *
 * Exported so a caller can TEST for the group rather than retyping the string:
 * the overview only explains the group when one is actually on screen, and a
 * second copy of this literal would quietly stop matching.
 */
export const UNKNOWN_VENDOR = "Unknown vendor"

/** The vendor to show: its name when known, else its code, else a placeholder. */
export function vendorLabel(chain: RepairChain): string {
  return chain.vendorName ?? chain.vendor ?? UNKNOWN_VENDOR
}

/** A number for display, or a placeholder when the source does not carry one. */
export function orUnknown(value: number | string | undefined): string {
  return value === undefined ? UNKNOWN : String(value)
}

/**
 * The exception vocabulary, shared by every screen that shows a finding.
 *
 * Here rather than in the exception table because the register's Exceptions
 * column, the repair detail page and the queue itself all render the same
 * items, and three private copies of these labels would drift apart.
 *
 * Open sets, not closed unions: the backend decides which checks exist and
 * adds to them (OVERDUE_REPAIR arrived after the first two), so an unknown
 * type renders as its raw value rather than disappearing.
 */
export const EXCEPTION_TYPE_LABEL: Record<string, string> = {
  MISSING_ATTESTATION: "No condition declaration",
  UNJUSTIFIED_ACQUISITION: "Bought new while a repair was open",
  MISSING_SESSION_ID: "No assistant session",
  OVERDUE_REPAIR: "Repair overdue",
}

export const EXCEPTION_SEVERITY_TONE: Record<string, Tone> = {
  info: "default",
  warning: "warning",
  critical: "danger",
}

/** A check's name as a reader would say it; the raw value if it is new here. */
export function exceptionTypeLabel(type: string): string {
  return EXCEPTION_TYPE_LABEL[type] ?? type
}

/**
 * FR-11's workflow vocabulary: open or closed, and nothing in between.
 *
 * A closed set, unlike the exception TYPES above: each status has behaviour
 * attached (what the default filter shows, which ones the queue may close by
 * itself), so adding a third is a conversation rather than a config change.
 */
export const EXCEPTION_STATUSES: readonly ExceptionStatus[] = ["OPEN", "CLOSED"]

export const EXCEPTION_STATUS_LABEL: Record<ExceptionStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
}

export const EXCEPTION_STATUS_TONE: Record<ExceptionStatus, Tone> = {
  OPEN: "danger",
  CLOSED: "default",
}

/**
 * What the two retired statuses read as. History is never rewritten, so a
 * backend older than 21-Oct-2026 — and an old `?status=` link — can still say
 * IN_PROGRESS or RESOLVED.
 */
const LEGACY_EXCEPTION_STATUS: Record<string, ExceptionStatus> = {
  IN_PROGRESS: "OPEN",
  RESOLVED: "CLOSED",
}

/** A status off the wire or the URL in today's vocabulary; undefined when it
 *  is neither a current nor a retired one. */
export function toExceptionStatus(raw: string | null | undefined): ExceptionStatus | undefined {
  if (!raw) return undefined
  const upper = raw.trim().toUpperCase()
  if ((EXCEPTION_STATUSES as readonly string[]).includes(upper)) return upper as ExceptionStatus
  return LEGACY_EXCEPTION_STATUS[upper]
}
