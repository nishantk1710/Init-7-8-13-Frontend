import {
  AGING_BAND_BOUNDS,
  ASSISTANT_CUTOVER,
  ATTESTATION_CUTOVER,
  OVERDUE_GRACE_DAYS,
} from "@demo/features/initiative-8/data/config"
import type {
  AgingBucket,
  AssistantSession,
  DeclarationRecord,
  DeclarationStatus,
  LeadTimeStatus,
  LifecycleStage,
  OverdueStatus,
  ReceiptStatus,
  RepairLineSeed,
  RepairStatus,
  RepairableUnitBasis,
  ReservationSeed,
  SessionLinkStatus,
  StageStep,
} from "@demo/features/initiative-8/types/repair"
import { dateOnly, dayOf, daysBetween, instantOf, labelOfDay } from "@demo/features/initiative-8/utils/dates"

/**
 * The Initiative 8 rules, as plain functions over the fixture facts — the same
 * rules live's backend applies (`app/initiatives/i8/*`), except where the FRS
 * asks for more and the Snapshot shows the FRS:
 *
 * - Overdue is EKET.EINDT plus the grace (FR-9), as live.
 * - A partial receipt keeps the line open for the units still out. Live
 *   counts any receipt as "returned"; the FRS tracks units back in stock.
 * - Declarations attach to repair lines by their explicit link, never by a
 *   date window.
 * - A repairable unit exists when there is stock, an open repair, or a unit
 *   at a vendor with no repair PO (FR-6, reading A).
 */

// ---------------------------------------------------------------------------
// Aging
// ---------------------------------------------------------------------------

export function agingBucketOf(days: number): AgingBucket {
  const [a, b, c, d] = AGING_BAND_BOUNDS
  if (days <= a) return "0-15"
  if (days <= b) return "16-30"
  if (days <= c) return "31-45"
  if (days <= d) return "46-60"
  return "60+"
}

// ---------------------------------------------------------------------------
// Where a line is
// ---------------------------------------------------------------------------

/** Every unit sent has come back. */
export function isFullyReceived(seed: RepairLineSeed): boolean {
  return !!seed.receivedAt && (seed.quantityReceived ?? seed.quantity) >= seed.quantity
}

/** Units still out: sent, less received; none once fully back or scrapped. */
export function qtyUnderRepairOf(seed: RepairLineSeed): number {
  if (seed.scrappedAt) return 0
  const received = seed.receivedAt ? (seed.quantityReceived ?? seed.quantity) : 0
  return Math.max(0, seed.quantity - received)
}

/** The aging clock starts at the repair PO line's creation date, or the PR's. */
export function lineStartOf(seed: RepairLineSeed): string {
  return seed.poIssuedAt ?? seed.prRaisedAt
}

/** Where the line stopped being out: full receipt, or scrapped. */
export function lineEndOf(seed: RepairLineSeed): string | undefined {
  if (seed.scrappedAt) return seed.scrappedAt
  return isFullyReceived(seed) ? seed.receivedAt : undefined
}

/** The line was out on this day: raised on or before it, not yet back. */
export function isOutOn(seed: RepairLineSeed, day: number): boolean {
  const start = dayOf(seed.prRaisedAt)
  if (start === undefined || day < start) return false
  const end = dayOf(lineEndOf(seed))
  return end === undefined || day < end
}

export function repairStatusOf(seed: RepairLineSeed): RepairStatus {
  if (seed.scrappedAt) return "Scrapped"
  if (isFullyReceived(seed)) return seed.backInStockAt ? "Closed" : "Received"
  if (seed.sentToVendorAt) return "At Vendor"
  if (seed.poIssuedAt) return "PO Issued"
  return "PR Raised"
}

export function receiptStatusOf(seed: RepairLineSeed): ReceiptStatus {
  if (isFullyReceived(seed)) return "Received"
  if (seed.receivedAt) return "Partially Received"
  if (seed.sentToVendorAt) return "Awaiting Receipt"
  return "Not Yet Shipped"
}

const STAGE_OF_STATUS: Record<RepairStatus, LifecycleStage> = {
  "PR Raised": "PR_RAISED",
  "PO Issued": "PO_ISSUED",
  "At Vendor": "AT_VENDOR",
  Received: "RETURNED",
  Closed: "BACK_IN_STOCK",
  Scrapped: "SCRAPPED",
}

export function stageOf(status: RepairStatus): LifecycleStage {
  return STAGE_OF_STATUS[status]
}

const STAGE_ORDER: LifecycleStage[] = [
  "REMOVED",
  "ATTESTED",
  "PR_RAISED",
  "PO_ISSUED",
  "AT_VENDOR",
  "RETURNED",
  "BACK_IN_STOCK",
  "SCRAPPED",
]

const TERMINAL_STAGES: LifecycleStage[] = ["BACK_IN_STOCK", "SCRAPPED"]

export function isTerminalStage(stage: LifecycleStage): boolean {
  return TERMINAL_STAGES.includes(stage)
}

/**
 * The line's dated steps, oldest first, each with the days until the next
 * one (or until `referenceDate` for the last, unless it is terminal).
 *
 * `attestedAt` is the first declaration that named the line. A partial
 * receipt is a note on the At-vendor step, not a step: the line has not left
 * that stage while units are still out.
 */
export function stagesOf(
  seed: RepairLineSeed,
  attestedAt: string | undefined,
  referenceDate: string,
): StageStep[] {
  const current = stageOf(repairStatusOf(seed))
  const raw: { stage: LifecycleStage; at?: string; note?: string }[] = [
    { stage: "REMOVED", at: seed.removedAt },
    { stage: "ATTESTED", at: attestedAt ? dateOnly(attestedAt) : undefined },
    { stage: "PR_RAISED", at: seed.prRaisedAt },
    { stage: "PO_ISSUED", at: seed.poIssuedAt },
    {
      stage: "AT_VENDOR",
      at: seed.sentToVendorAt,
      note:
        seed.receivedAt && !isFullyReceived(seed)
          ? `${seed.quantityReceived ?? 0} of ${seed.quantity} received ${seed.receivedAt}`
          : undefined,
    },
    { stage: "RETURNED", at: isFullyReceived(seed) ? seed.receivedAt : undefined },
    { stage: "BACK_IN_STOCK", at: seed.backInStockAt },
    { stage: "SCRAPPED", at: seed.scrappedAt },
  ]
  const dated = raw
    .filter((s): s is { stage: LifecycleStage; at: string; note?: string } => !!s.at)
    .sort(
      (a, b) =>
        (dayOf(a.at) ?? 0) - (dayOf(b.at) ?? 0) ||
        STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
    )

  return dated.map((step, index) => {
    const next = dated[index + 1]
    const days = next
      ? (daysBetween(step.at, next.at) ?? 0)
      : isTerminalStage(step.stage)
        ? 0
        : (daysBetween(step.at, referenceDate) ?? 0)
    return { stage: step.stage, at: step.at, days, current: step.stage === current, note: step.note }
  })
}

// ---------------------------------------------------------------------------
// Due date (FR-9) and lead time
// ---------------------------------------------------------------------------

export interface DueDate {
  status: OverdueStatus
  /** Negative once EINDT has passed. */
  daysRemaining?: number
  /** Days past EINDT. Positive inside the grace too. */
  daysPastDue?: number
  /** Past EINDT, not yet past the grace. */
  inGrace: boolean
}

export function dueDateOf(seed: RepairLineSeed, referenceDate: string): DueDate {
  if (seed.scrappedAt) return { status: "SCRAPPED", inGrace: false }
  if (isFullyReceived(seed)) return { status: "RECEIVED", inGrace: false }
  if (!seed.expectedReturn) return { status: "NO_DUE_DATE", inGrace: false }
  const daysPastDue = daysBetween(seed.expectedReturn, referenceDate) ?? 0
  return {
    status: daysPastDue > OVERDUE_GRACE_DAYS ? "OVERDUE" : "ON_TIME",
    daysRemaining: -daysPastDue,
    daysPastDue,
    inGrace: daysPastDue > 0 && daysPastDue <= OVERDUE_GRACE_DAYS,
  }
}

/** The day a line became overdue: the day after the grace ran out. */
export function overdueSinceOf(seed: RepairLineSeed): string | undefined {
  const due = dayOf(seed.expectedReturn)
  return due === undefined ? undefined : labelOfDay(due + OVERDUE_GRACE_DAYS + 1)
}

export function leadTimeOf(
  daysElapsed: number,
  plannedDeliveryDays: number | undefined,
): { leadTimeStatus: LeadTimeStatus; daysOverLeadTime?: number } {
  if (plannedDeliveryDays === undefined) return { leadTimeStatus: "NO_LEAD_TIME" }
  const daysOverLeadTime = daysElapsed - plannedDeliveryDays
  return {
    leadTimeStatus: daysOverLeadTime > 0 ? "BEYOND_LEAD_TIME" : "WITHIN_LEAD_TIME",
    daysOverLeadTime,
  }
}

/** Vendor turnaround (FR-3): dispatch (541) to receipt, for lines fully back. */
export function turnaroundOf(seed: RepairLineSeed): number | undefined {
  if (!isFullyReceived(seed) || !seed.sentToVendorAt) return undefined
  return daysBetween(seed.sentToVendorAt, seed.receivedAt)
}

// ---------------------------------------------------------------------------
// Declarations (FR-4)
// ---------------------------------------------------------------------------

/** Every record, with `supersededBy` filled in from whatever supersedes it. */
export function withSupersession(records: DeclarationRecord[]): DeclarationRecord[] {
  const replacedBy = new Map<string, string>()
  for (const record of records) {
    if (record.supersedes) replacedBy.set(record.supersedes, record.id)
  }
  return records.map((record) =>
    replacedBy.has(record.id) ? { ...record, supersededBy: replacedBy.get(record.id) } : record,
  )
}

/** Newest first, by declaration time. */
export function byNewest<T extends { declaredAt: string }>(a: T, b: T): number {
  return instantOf(b.declaredAt) - instantOf(a.declaredAt)
}

/**
 * A repair line's Declaration status, from the declarations in force that
 * name it. Repairable is Completed. Beyond Economical Repair or Scrap is
 * Flagged — assessed not worth repairing, sent anyway — unless the line was
 * scrapped, in which case the assessment and the outcome agree.
 */
export function declarationStatusFor(
  seed: RepairLineSeed,
  inForce: DeclarationRecord[],
): { status: DeclarationStatus; record?: DeclarationRecord } {
  const record = inForce.filter((d) => d.repairLineIds.includes(seed.id)).sort(byNewest)[0]
  if (!record) return { status: "Required" }
  if (record.condition === "Repairable" || seed.scrappedAt) return { status: "Completed", record }
  return { status: "Flagged", record }
}

/** Raised before the declaration control went live. */
export function isBeforeAttestationControl(date: string): boolean {
  return (dayOf(date) ?? 0) < (dayOf(ATTESTATION_CUTOVER) ?? 0)
}

/** Before the Spares Assistant went live: no session id or justification possible. */
export function isBeforeAssistant(date: string): boolean {
  return (dayOf(date) ?? 0) < (dayOf(ASSISTANT_CUTOVER) ?? 0)
}

// ---------------------------------------------------------------------------
// Sessions (FR-8)
// ---------------------------------------------------------------------------

/** A session id as live issues them: `S`, eight characters, a check character. */
export const SESSION_ID_PATTERN = /\bS[A-Z0-9]{9}\b/

/**
 * Whether a reservation's item text carries a valid session id: one that
 * exists, for the same material and plant.
 */
export function sessionLinkOf(
  reservation: ReservationSeed,
  sessions: AssistantSession[],
): { status: SessionLinkStatus; sessionId?: string; quoted?: string } {
  const text = reservation.itemText?.trim()
  if (!text) return { status: "MISSING" }
  const quoted = text.toUpperCase().match(SESSION_ID_PATTERN)?.[0]
  const session = quoted ? sessions.find((s) => s.id === quoted) : undefined
  if (!session) return { status: "UNKNOWN_SESSION", quoted: quoted ?? text }
  if (session.materialId !== reservation.materialId || session.plantId !== reservation.plantId) {
    return { status: "OTHER_PART", quoted }
  }
  return { status: "VALID", sessionId: session.id, quoted }
}

// ---------------------------------------------------------------------------
// The repairable-unit rule (FR-6)
// ---------------------------------------------------------------------------

/**
 * Every reason a repairable unit exists: (a) stock on the shelf, an open
 * repair, or (b) a unit at a vendor on a 541 with no repair PO behind it.
 */
export function repairableUnitBasis({
  stock,
  openRepairs,
  atVendorNoPo,
}: {
  stock: number | undefined
  openRepairs: number
  atVendorNoPo: number
}): RepairableUnitBasis[] {
  const basis: RepairableUnitBasis[] = []
  if ((stock ?? 0) > 0) basis.push("STOCK")
  if (openRepairs > 0) basis.push("OPEN_REPAIR")
  if (atVendorNoPo > 0) basis.push("AT_VENDOR_NO_PO")
  return basis
}
