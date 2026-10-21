import { ASSISTANT_SESSIONS, RESERVATIONS } from "@demo/features/initiative-8/data/assistant"
import { CODING_CANDIDATES } from "@demo/features/initiative-8/data/coding-candidates"
import {
  CODING_CONFIDENCE_THRESHOLD,
  OVERDUE_GRACE_DAYS,
  REFERENCE_DATE,
  plantRef,
} from "@demo/features/initiative-8/data/config"
import { SEED_DECLARATIONS } from "@demo/features/initiative-8/data/declarations"
import { EARLIER_FINDINGS, EXCEPTION_HISTORY } from "@demo/features/initiative-8/data/exceptions"
import { SEED_JUSTIFICATIONS } from "@demo/features/initiative-8/data/justifications"
import { MATERIALS, getMaterial, materialRef } from "@demo/features/initiative-8/data/materials"
import { NEW_UNIT_PURCHASES, UNPAPERED_DISPATCHES } from "@demo/features/initiative-8/data/purchases"
import { REPAIR_LINE_SEEDS } from "@demo/features/initiative-8/data/repair-lines"
import {
  agingBucketOf,
  byNewest,
  declarationStatusFor,
  dueDateOf,
  isBeforeAssistant,
  isBeforeAttestationControl,
  isOutOn,
  isTerminalStage,
  leadTimeOf,
  lineEndOf,
  lineStartOf,
  qtyUnderRepairOf,
  receiptStatusOf,
  repairStatusOf,
  repairableUnitBasis,
  sessionLinkOf,
  stageOf,
  stagesOf,
  turnaroundOf,
  withSupersession,
} from "@demo/features/initiative-8/model/rules"
import type {
  AssistantSession,
  DeclarationRecord,
  ExceptionEvent,
  ExceptionFinding,
  ExceptionStatus,
  JustificationEntry,
  NewUnitPurchase,
  RankedCodingCandidate,
  RepairChain,
  RepairException,
  RepairLineSeed,
  RepairableUnitBasis,
  ReservationRow,
  UniverseRow,
  UnpaperedDispatch,
} from "@demo/features/initiative-8/types/repair"
import { dayOf, daysBetween, instantOf, labelOfDay } from "@demo/features/initiative-8/utils/dates"
import type { MaterialReference, PlantReference, SAPDocumentReference } from "@demo/lib/domain/contracts"

/**
 * Everything the six Initiative 8 screens show, built from the fixtures plus
 * whatever the viewer has done this session (`SnapshotActions`) — so a
 * declaration recorded on one screen is in the register, the exception queue
 * and the overview the moment it is saved. Nothing is posted anywhere.
 *
 * The exception queue works the way FR-11 asks: every item is found by a
 * check, carries a stored history (owner, comments, status), and is resolved
 * automatically — with the reason — once its check stops finding it.
 */

// ---------------------------------------------------------------------------
// Session actions
// ---------------------------------------------------------------------------

/** What the viewer has done in this browser session. */
export interface SnapshotActions {
  declarations: DeclarationRecord[]
  justifications: JustificationEntry[]
  exceptionEvents: Record<string, ExceptionEvent[]>
  /** Set when "Run AI screen" was pressed. */
  screenedAt?: string
}

export const NO_ACTIONS: SnapshotActions = { declarations: [], justifications: [], exceptionEvents: {} }

/** How many things the viewer has changed — zero means the Snapshot as shipped. */
export function countActions(actions: SnapshotActions): number {
  return (
    actions.declarations.length +
    actions.justifications.length +
    Object.values(actions.exceptionEvents).reduce((sum, events) => sum + events.length, 0) +
    (actions.screenedAt ? 1 : 0)
  )
}

// ---------------------------------------------------------------------------
// Rows the screens read besides repair lines
// ---------------------------------------------------------------------------

/** A new-unit purchase with the FR-6 check's answer for the day it was raised. */
export interface PurchaseRow extends NewUnitPurchase {
  material: MaterialReference
  plant: PlantReference
  /** Every reason a repairable unit existed that day. Empty: the check passed. */
  basis: RepairableUnitBasis[]
  /** Repair lines out on the day it was raised. */
  openRepairIds: string[]
  justificationId?: string
  exceptionId: string
  preAutomation: boolean
}

export interface DispatchRow extends UnpaperedDispatch {
  material: MaterialReference
  plant: PlantReference
}

/** An assistant session, with everything it links to (FR-8). */
export interface SessionRow extends AssistantSession {
  material: MaterialReference
  plant: PlantReference
  reservation?: SAPDocumentReference
  repairId?: string
  declarationIds: string[]
  justificationIds: string[]
  /** Unit value × quantity, when the assistant found a repairable unit and the
   *  requester chose repair after that advice. Zero otherwise. */
  avoidedValue: number
}

export interface I8Snapshot {
  referenceDate: string
  lines: RepairChain[]
  /** Every declaration, amended ones included, newest first. */
  declarations: DeclarationRecord[]
  /** Newest first. */
  justifications: JustificationEntry[]
  /** Newest raised first. */
  exceptions: RepairException[]
  universe: UniverseRow[]
  /** Flagged for deletion in MARA, so left out of the universe. */
  excludedMaterials: MaterialReference[]
  sessions: SessionRow[]
  reservations: ReservationRow[]
  purchases: PurchaseRow[]
  dispatches: DispatchRow[]
  codingCandidates: RankedCodingCandidate[]
  actionCount: number
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sameDocument(
  a: SAPDocumentReference | undefined,
  b: SAPDocumentReference | undefined,
): boolean {
  return !!a && !!b && a.documentNumber === b.documentNumber && (a.line ?? "") === (b.line ?? "")
}

export function documentLabel(doc: SAPDocumentReference | undefined): string {
  if (!doc) return ""
  return doc.line ? `${doc.documentNumber}/${doc.line}` : doc.documentNumber
}

function digitsOf(documentNumber: string): string {
  return String(Number(documentNumber.replace(/\D/g, "")))
}

function later(a: string, b: string): string {
  return instantOf(a) >= instantOf(b) ? a : b
}

const BASIS_PHRASE: Record<RepairableUnitBasis, string> = {
  STOCK: "stock on the shelf",
  OPEN_REPAIR: "a repair still open",
  AT_VENDOR_NO_PO: "a unit at a vendor with no repair PO",
}

// ---------------------------------------------------------------------------
// Repair lines
// ---------------------------------------------------------------------------

function nextActionOf(line: Omit<RepairChain, "declarationNextAction">): string {
  if (line.declarationStatus === "Flagged") {
    return `Assessed as ${line.condition} by ${line.declaredBy} but sent for repair anyway — confirm the decision before the unit comes back.`
  }
  if (line.declarationStatus === "Completed") {
    return line.repairStatus === "Scrapped"
      ? `None. Assessed ${line.condition} and the repair line was cancelled.`
      : `None. Declared ${line.condition} by ${line.declaredBy}.`
  }
  if (line.overdueStatus === "RECEIVED" || line.overdueStatus === "SCRAPPED") {
    return line.preAutomation
      ? "Raised before the declaration control went live, so nothing could be declared then. A late declaration can still be recorded for the record."
      : "The part came back with no declaration on record — record one so the repair is covered."
  }
  if (line.repairStatus === "PR Raised" || line.repairStatus === "PO Issued") {
    return "Declare the part's condition before it ships to the vendor."
  }
  return line.preAutomation
    ? "Raised before the declaration control went live. Declare the condition now so the repair is covered."
    : "The part went to the vendor with no condition assessment on record. Declare it now."
}

function buildLine(
  seed: RepairLineSeed,
  allDeclarations: DeclarationRecord[],
  inForce: DeclarationRecord[],
): RepairChain {
  const material = getMaterial(seed.materialId)
  const plantSeed = material?.plants.find((p) => p.plantId === seed.plantId)
  const repairStatus = repairStatusOf(seed)
  const due = dueDateOf(seed, REFERENCE_DATE)
  const daysOpen = Math.max(0, daysBetween(lineStartOf(seed), lineEndOf(seed) ?? REFERENCE_DATE) ?? 0)
  const { status: declarationStatus, record } = declarationStatusFor(seed, inForce)
  const firstDeclaration = allDeclarations
    .filter((d) => d.repairLineIds.includes(seed.id))
    .sort(byNewest)
    .at(-1)
  const stages = stagesOf(seed, firstDeclaration?.declaredAt, REFERENCE_DATE)
  const stage = stageOf(repairStatus)
  const stageEnteredAt = [...stages].reverse().find((s) => s.stage === stage)?.at ?? seed.prRaisedAt
  const daysInStage = isTerminalStage(stage) ? 0 : Math.max(0, daysBetween(stageEnteredAt, REFERENCE_DATE) ?? 0)
  const lead = leadTimeOf(daysOpen, plantSeed?.plannedDeliveryDays)

  const line: Omit<RepairChain, "declarationNextAction"> = {
    id: seed.id,
    material: materialRef(seed.materialId),
    plant: plantRef(seed.plantId),
    stockOnHand: plantSeed?.stockOnHand,
    reorderPoint: plantSeed?.reorderPoint,
    qtyUnderRepair: qtyUnderRepairOf(seed),
    quantity: seed.quantity,
    repairPR: seed.repairPR,
    repairPO: seed.repairPO,
    reservation: seed.reservation,
    sessionId: seed.sessionId,
    vendor: seed.vendor,
    repairStatus,
    receiptStatus: receiptStatusOf(seed),
    stage,
    stageEnteredAt,
    daysInStage,
    stageAgingBucket: agingBucketOf(daysInStage),
    stages,
    declarationStatus,
    daysOpen,
    agingBucket: agingBucketOf(daysOpen),
    criticality: material?.criticality,
    daysElapsed: daysOpen,
    leadTimeDays: plantSeed?.plannedDeliveryDays,
    leadTimeStatus: lead.leadTimeStatus,
    daysOverLeadTime: lead.daysOverLeadTime,
    poBlocked: seed.poBlocked,
    removedAt: seed.removedAt,
    raisedAt: seed.prRaisedAt,
    poIssuedAt: seed.poIssuedAt,
    sentToVendorAt: seed.sentToVendorAt,
    expectedReturn: seed.expectedReturn,
    overdueStatus: due.status,
    daysRemainingInRepair: due.daysRemaining,
    daysPastDue: due.daysPastDue,
    inGrace: due.inGrace,
    receivedAt: seed.receivedAt,
    backInStockAt: seed.backInStockAt,
    scrappedAt: seed.scrappedAt,
    turnaroundDays: turnaroundOf(seed),
    newUnitCost: material?.unitValue ?? 0,
    repairCost: seed.repairCost,
    newUnitLeadTimeDays: material?.newUnitLeadTimeDays ?? 0,
    notes: seed.notes,
    requester: seed.requester,
    preAutomation: isBeforeAttestationControl(seed.prRaisedAt),
    declarationId: record?.id,
    declaredBy: record?.declaredBy,
    declaredAt: record?.declaredAt,
    condition: record?.condition,
    openExceptionIds: [],
  }
  return { ...line, declarationNextAction: nextActionOf(line) }
}

// ---------------------------------------------------------------------------
// Purchases, reservations
// ---------------------------------------------------------------------------

function buildPurchase(purchase: NewUnitPurchase, justifications: JustificationEntry[]): PurchaseRow {
  const day = dayOf(purchase.raisedAt) ?? 0
  const samePart = (x: { materialId: string; plantId: string }) =>
    x.materialId === purchase.materialId && x.plantId === purchase.plantId
  const openRepairIds = REPAIR_LINE_SEEDS.filter((s) => samePart(s) && isOutOn(s, day)).map((s) => s.id)
  const atVendorNoPo = UNPAPERED_DISPATCHES.filter(
    (d) => samePart(d) && (dayOf(d.postedAt) ?? Infinity) <= day,
  ).reduce((sum, d) => sum + d.quantity, 0)
  return {
    ...purchase,
    material: materialRef(purchase.materialId),
    plant: plantRef(purchase.plantId),
    basis: repairableUnitBasis({ stock: purchase.stockAtTime, openRepairs: openRepairIds.length, atVendorNoPo }),
    openRepairIds,
    justificationId: justifications.find((j) => sameDocument(j.acquisitionLine, purchase.line))?.id,
    exceptionId: `EX-UA-${digitsOf(purchase.line.documentNumber)}`,
    preAutomation: isBeforeAssistant(purchase.raisedAt),
  }
}

function buildReservations(): ReservationRow[] {
  return RESERVATIONS.map((r) => {
    const link = sessionLinkOf(r, ASSISTANT_SESSIONS)
    return {
      ...r,
      material: materialRef(r.materialId),
      plant: plantRef(r.plantId),
      sessionLink: link.status,
      sessionId: link.sessionId,
      quotedSessionId: link.quoted,
      repairId: REPAIR_LINE_SEEDS.find((s) => sameDocument(s.reservation, r.reservation))?.id,
      preAutomation: isBeforeAssistant(r.createdAt),
    }
  })
}

// ---------------------------------------------------------------------------
// The four checks (FR-8, FR-9)
// ---------------------------------------------------------------------------

function overdueFinding(line: RepairChain): ExceptionFinding {
  const due = dayOf(line.expectedReturn) ?? 0
  const graceEnded = labelOfDay(due + OVERDUE_GRACE_DAYS)
  const doc = documentLabel(line.repairPO ?? line.repairPR)
  return {
    id: `EX-OD-${line.id.replace("RC-", "")}`,
    type: "OVERDUE_REPAIR",
    severity: line.criticality === "CRITICAL" || (line.daysPastDue ?? 0) > 30 ? "critical" : "warning",
    material: line.material,
    plant: line.plant,
    title: `Repair overdue at ${line.vendor}`,
    detail:
      `${doc} was due back ${line.expectedReturn} (EKET); the ${OVERDUE_GRACE_DAYS}-day grace ended ${graceEnded}. ` +
      (line.overdueStatus === "OVERDUE"
        ? `${line.qtyUnderRepair} unit(s) still out, ${line.daysPastDue} days past the due date.`
        : line.receivedAt
          ? `The unit came back ${line.receivedAt}.`
          : "The line is no longer out."),
    raisedAt: labelOfDay(due + OVERDUE_GRACE_DAYS + 1),
    repairId: line.id,
    repairLine: line.repairPO ?? line.repairPR,
    preAutomation: false,
  }
}

function missingAttestationFinding(line: RepairChain): ExceptionFinding {
  const docs = [line.repairPR, line.repairPO].filter(Boolean).map((d) => documentLabel(d)).join(" / ")
  return {
    id: `EX-MA-${line.id.replace("RC-", "")}`,
    type: "MISSING_ATTESTATION",
    severity: line.preAutomation ? "info" : "warning",
    material: line.material,
    plant: line.plant,
    title: "Repair raised with no condition declaration",
    detail:
      `${docs} for ${line.quantity} unit(s) at ${line.vendor} was raised on ${line.raisedAt} and no declaration names it.` +
      (line.preAutomation
        ? " Raised before the declaration control went live — nothing could have been recorded."
        : ""),
    raisedAt: line.raisedAt,
    repairId: line.id,
    repairLine: line.repairPO ?? line.repairPR,
    preAutomation: line.preAutomation,
  }
}

const SESSION_TITLE: Record<Exclude<ReservationRow["sessionLink"], "VALID">, string> = {
  MISSING: "80-series reservation with no session ID",
  UNKNOWN_SESSION: "Reservation quotes a session ID nobody issued",
  OTHER_PART: "Reservation quotes another part's session ID",
}

function missingSessionFinding(
  reservation: ReservationRow,
  lines: RepairChain[],
): ExceptionFinding {
  const line = lines.find((l) => l.id === reservation.repairId)
  const sameMorning = ASSISTANT_SESSIONS.find(
    (s) =>
      s.materialId === reservation.materialId &&
      s.plantId === reservation.plantId &&
      daysBetween(s.openedAt, reservation.createdAt) === 0,
  )
  const quoted =
    reservation.sessionLink === "MISSING"
      ? "Its item text is blank"
      : `Its item text quotes "${reservation.quotedSessionId ?? reservation.itemText}"`
  const why =
    reservation.sessionLink === "OTHER_PART"
      ? ", a session for a different material or plant"
      : reservation.sessionLink === "UNKNOWN_SESSION"
        ? ", which no session carries"
        : ""
  return {
    id: `EX-MS-${digitsOf(reservation.reservation.documentNumber)}`,
    type: "MISSING_SESSION_ID",
    severity: reservation.preAutomation ? "info" : "warning",
    material: reservation.material,
    plant: reservation.plant,
    title: reservation.sessionLink === "VALID" ? "Reservation session ID" : SESSION_TITLE[reservation.sessionLink],
    detail:
      `Reservation ${documentLabel(reservation.reservation)} for ${reservation.quantity} unit(s), raised ${reservation.createdAt} by ${reservation.requester}. ${quoted}${why}, so the reservation cannot be traced to the assistant's advice.` +
      (sameMorning ? ` Session ${sameMorning.id} for this part was opened the same day.` : "") +
      (reservation.preAutomation ? " Raised before the Spares Assistant went live." : ""),
    raisedAt: reservation.createdAt,
    repairId: line?.id,
    repairLine: line ? (line.repairPO ?? line.repairPR) : undefined,
    reservation: reservation.reservation,
    preAutomation: reservation.preAutomation,
  }
}

function unjustifiedFinding(purchase: PurchaseRow, lines: RepairChain[]): ExceptionFinding {
  const line = lines.find((l) => l.id === purchase.openRepairIds[0])
  const by = purchase.requester === "MRP" ? "raised by the MRP run" : `raised by ${purchase.requester}`
  const basis = purchase.basis.map((b) => BASIS_PHRASE[b]).join(", ")
  return {
    id: purchase.exceptionId,
    type: "UNJUSTIFIED_ACQUISITION",
    severity: purchase.preAutomation ? "info" : "critical",
    material: purchase.material,
    plant: purchase.plant,
    title: "New unit bought while a repairable unit existed",
    detail:
      `${documentLabel(purchase.line)} for ${purchase.quantity} new unit(s), ${by} on ${purchase.raisedAt}. ` +
      `At the time there was ${basis || "no repairable unit"}` +
      (line ? ` (${line.id} at ${line.vendor})` : "") +
      ". No justification named the purchase when the check ran." +
      (purchase.preAutomation ? " Bought before the justification control existed." : ""),
    raisedAt: purchase.raisedAt,
    repairId: line?.id,
    repairLine: line ? (line.repairPO ?? line.repairPR) : undefined,
    acquisitionLine: purchase.line,
    preAutomation: purchase.preAutomation,
  }
}

interface Core {
  declarations: DeclarationRecord[]
  justifications: JustificationEntry[]
  lines: RepairChain[]
  purchases: PurchaseRow[]
  reservations: ReservationRow[]
  findings: Map<string, ExceptionFinding>
}

function buildCore(declarations: DeclarationRecord[], justifications: JustificationEntry[]): Core {
  const all = withSupersession(declarations)
  const inForce = all.filter((d) => !d.supersededBy)
  const lines = REPAIR_LINE_SEEDS.map((seed) => buildLine(seed, all, inForce))
  const purchases = NEW_UNIT_PURCHASES.map((p) => buildPurchase(p, justifications))
  const reservations = buildReservations()

  const findings = new Map<string, ExceptionFinding>()
  const add = (finding: ExceptionFinding) => findings.set(finding.id, finding)
  for (const line of lines) {
    if (line.overdueStatus === "OVERDUE") add(overdueFinding(line))
    if (line.declarationStatus === "Required") add(missingAttestationFinding(line))
  }
  for (const reservation of reservations) {
    if (reservation.sessionLink !== "VALID") add(missingSessionFinding(reservation, lines))
  }
  for (const purchase of purchases) {
    if (purchase.basis.length > 0 && !purchase.justificationId) add(unjustifiedFinding(purchase, lines))
  }
  return { declarations: all, justifications, lines, purchases, reservations, findings }
}

/** Builds a finding for an id the checks no longer raise, from the same data. */
function describeById(id: string, core: Core): ExceptionFinding | undefined {
  const key = id.slice(6)
  if (id.startsWith("EX-OD-")) {
    const line = core.lines.find((l) => l.id === `RC-${key}`)
    return line && line.expectedReturn ? overdueFinding(line) : undefined
  }
  if (id.startsWith("EX-MA-")) {
    const line = core.lines.find((l) => l.id === `RC-${key}`)
    return line ? missingAttestationFinding(line) : undefined
  }
  if (id.startsWith("EX-MS-")) {
    const reservation = core.reservations.find((r) => digitsOf(r.reservation.documentNumber) === key)
    return reservation ? missingSessionFinding(reservation, core.lines) : undefined
  }
  if (id.startsWith("EX-UA-")) {
    const purchase = core.purchases.find((p) => p.exceptionId === id)
    return purchase ? unjustifiedFinding(purchase, core.lines) : undefined
  }
  return undefined
}

function isOpenStatus(status: ExceptionStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS"
}

/** Why a check stopped finding an item, and when. */
function autoResolution(finding: ExceptionFinding, core: Core): { at: string; text: string } {
  if (finding.type === "MISSING_ATTESTATION") {
    const line = core.lines.find((l) => l.id === finding.repairId)
    if (line?.declarationId && line.declaredAt) {
      return { at: line.declaredAt, text: `Declaration ${line.declarationId} now covers this line (${line.condition}).` }
    }
  }
  if (finding.type === "UNJUSTIFIED_ACQUISITION") {
    const purchase = core.purchases.find((p) => p.exceptionId === finding.id)
    const justification = core.justifications.find((j) => j.id === purchase?.justificationId)
    if (justification) {
      return { at: justification.recordedAt, text: `Justification ${justification.id} recorded for this purchase.` }
    }
  }
  if (finding.type === "OVERDUE_REPAIR") {
    const line = core.lines.find((l) => l.id === finding.repairId)
    if (line?.receivedAt) return { at: line.receivedAt, text: "Goods receipt posted — the unit is back." }
  }
  return { at: REFERENCE_DATE, text: "The check no longer finds this." }
}

const CHECK_NAME: Record<ExceptionFinding["type"], string> = {
  OVERDUE_REPAIR: "overdue-repair",
  MISSING_ATTESTATION: "missing-attestation",
  MISSING_SESSION_ID: "session-ID",
  UNJUSTIFIED_ACQUISITION: "unjustified-acquisition",
}

function assembleExceptions(current: Core, base: Core, actions: SnapshotActions): RepairException[] {
  const ids = new Set<string>([
    ...current.findings.keys(),
    ...base.findings.keys(),
    ...EARLIER_FINDINGS,
    ...Object.keys(actions.exceptionEvents),
  ])
  const exceptions: RepairException[] = []
  for (const id of ids) {
    const finding = current.findings.get(id) ?? base.findings.get(id) ?? describeById(id, current)
    if (!finding) continue
    const stillDetected = current.findings.has(id)
    const raised: ExceptionEvent = {
      at: finding.raisedAt,
      actor: "System",
      kind: "RAISED",
      status: "OPEN",
      text: `Raised by the ${CHECK_NAME[finding.type]} check.`,
    }
    const history = [raised, ...(EXCEPTION_HISTORY[id] ?? []), ...(actions.exceptionEvents[id] ?? [])].sort(
      (a, b) => instantOf(a.at) - instantOf(b.at),
    )
    let status = history.reduce<ExceptionStatus>((s, e) => e.status ?? s, "OPEN")
    if (!stillDetected && isOpenStatus(status)) {
      const resolution = autoResolution(finding, current)
      history.push({
        at: later(resolution.at, history[history.length - 1].at),
        actor: "System",
        kind: "AUTO_RESOLVED",
        status: "RESOLVED",
        text: resolution.text,
      })
      status = "RESOLVED"
    }
    const owner = [...history].reverse().find((e) => e.kind === "ASSIGNED")?.owner
    const resolvedAt = [...history].reverse().find((e) => e.status === "RESOLVED")?.at
    const closedAt = status === "CLOSED" ? [...history].reverse().find((e) => e.status === "CLOSED")?.at : undefined
    exceptions.push({ ...finding, status, owner, stillDetected, history, resolvedAt, closedAt })
  }
  return exceptions.sort((a, b) => instantOf(b.raisedAt) - instantOf(a.raisedAt) || a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Coding candidates (FR-2)
// ---------------------------------------------------------------------------

const VERDICT_ORDER = ["MISCODED_REPAIRABLE", "UNCLEAR", "REPAIR_SERVICE", "CONSUMABLE_FOR_REPAIR"]
const CONFIDENCE_ORDER = ["high", "medium", "low"]

function rankOf(list: string[], value: string): number {
  const index = list.indexOf(value)
  return index < 0 ? list.length : index
}

function rankCodingCandidates(screenedAt: string | undefined): RankedCodingCandidate[] {
  const threshold = rankOf(CONFIDENCE_ORDER, CODING_CONFIDENCE_THRESHOLD)
  return CODING_CANDIDATES.map((c) => ({
    ...c,
    screenedAt: screenedAt ?? c.screenedAt,
    rank: 0,
    plants: [...new Map(c.lines.map((l) => [l.plant.plantId, l.plant])).values()],
    sources: [...new Set(c.lines.map((l) => l.source))],
    isCorroborated: c.twins.length > 0,
    isActionable: c.verdict === "MISCODED_REPAIRABLE" || c.verdict === "UNCLEAR",
    meetsConfidenceThreshold: rankOf(CONFIDENCE_ORDER, c.confidence) <= threshold,
  }))
    .sort(
      (a, b) =>
        Number(b.isActionable) - Number(a.isActionable) ||
        rankOf(VERDICT_ORDER, a.verdict) - rankOf(VERDICT_ORDER, b.verdict) ||
        rankOf(CONFIDENCE_ORDER, a.confidence) - rankOf(CONFIDENCE_ORDER, b.confidence) ||
        Number(b.isCorroborated) - Number(a.isCorroborated) ||
        b.lines.length - a.lines.length ||
        a.material.materialId.localeCompare(b.material.materialId),
    )
    .map((c, index) => ({ ...c, rank: index + 1 }))
}

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

let baseCore: Core | undefined
function getBaseCore(): Core {
  baseCore ??= buildCore(SEED_DECLARATIONS, SEED_JUSTIFICATIONS)
  return baseCore
}

export function buildSnapshot(actions: SnapshotActions = NO_ACTIONS): I8Snapshot {
  const base = getBaseCore()
  const core =
    actions.declarations.length === 0 && actions.justifications.length === 0
      ? base
      : buildCore(
          [...SEED_DECLARATIONS, ...actions.declarations],
          [...SEED_JUSTIFICATIONS, ...actions.justifications],
        )
  const exceptions = assembleExceptions(core, base, actions)

  const justificationById = new Map(core.justifications.map((j) => [j.id, j]))
  const lines = core.lines.map((line) => {
    const overlapping = core.purchases.filter((p) => p.openRepairIds.includes(line.id))
    const entries = overlapping.flatMap((p) => {
      const j = p.justificationId ? justificationById.get(p.justificationId) : undefined
      return j
        ? [{ id: j.id, reasonCategory: j.reasonCategory, freeText: j.freeText, author: j.author, recordedAt: j.recordedAt, sessionId: j.sessionId }]
        : []
    })
    const unjustifiedPurchases = overlapping
      .filter((p) => !p.justificationId)
      .map((p) => ({ exceptionId: p.exceptionId, purchase: p.line, raisedAt: p.raisedAt, preAutomation: p.preAutomation }))
    return {
      ...line,
      justification:
        entries.length + unjustifiedPurchases.length > 0
          ? {
              status: unjustifiedPurchases.length > 0 ? ("MISSING" as const) : ("RECORDED" as const),
              entries,
              unjustifiedPurchases,
            }
          : undefined,
      openExceptionIds: exceptions
        .filter((e) => e.repairId === line.id && isOpenStatus(e.status))
        .map((e) => e.id),
    }
  })

  const isOpenLine = (l: RepairChain) => l.overdueStatus !== "RECEIVED" && l.overdueStatus !== "SCRAPPED"
  const universe: UniverseRow[] = MATERIALS.filter((m) => !m.deletionFlag).flatMap((m) =>
    m.plants.map((p) => {
      const open = lines.filter(
        (l) => l.material.materialId === m.materialId && l.plant.plantId === p.plantId && isOpenLine(l),
      )
      const qtyAtVendorNoPo = UNPAPERED_DISPATCHES.filter(
        (d) => d.materialId === m.materialId && d.plantId === p.plantId,
      ).reduce((sum, d) => sum + d.quantity, 0)
      return {
        material: materialRef(m.materialId),
        plant: plantRef(p.plantId),
        criticality: m.criticality,
        stockOnHand: p.stockOnHand,
        reorderPoint: p.reorderPoint,
        plannedDeliveryDays: p.plannedDeliveryDays,
        mrpType: p.mrpType,
        unitValue: m.unitValue,
        inMaterialMaster: m.inMaterialMaster,
        openRepairLines: open.length,
        qtyUnderRepair: open.reduce((sum, l) => sum + l.qtyUnderRepair, 0),
        qtyAtVendorNoPo,
        repairableUnit: repairableUnitBasis({ stock: p.stockOnHand, openRepairs: open.length, atVendorNoPo: qtyAtVendorNoPo }),
      }
    }),
  )

  const sessions: SessionRow[] = ASSISTANT_SESSIONS.map((s) => ({
    ...s,
    material: materialRef(s.materialId),
    plant: plantRef(s.plantId),
    reservation: core.reservations.find((r) => r.sessionId === s.id)?.reservation,
    repairId: REPAIR_LINE_SEEDS.find((l) => l.sessionId === s.id)?.id,
    declarationIds: core.declarations.filter((d) => d.sessionId === s.id).map((d) => d.id),
    justificationIds: core.justifications.filter((j) => j.sessionId === s.id).map((j) => j.id),
    avoidedValue: s.outcome === "CHOSE_REPAIR" && s.basis.length > 0 ? s.quantity * (getMaterial(s.materialId)?.unitValue ?? 0) : 0,
  }))

  return {
    referenceDate: REFERENCE_DATE,
    lines,
    declarations: [...core.declarations].sort(byNewest),
    justifications: [...core.justifications].sort((a, b) => instantOf(b.recordedAt) - instantOf(a.recordedAt)),
    exceptions,
    universe,
    excludedMaterials: MATERIALS.filter((m) => m.deletionFlag).map((m) => materialRef(m.materialId)),
    sessions,
    reservations: core.reservations,
    purchases: core.purchases,
    dispatches: UNPAPERED_DISPATCHES.map((d) => ({ ...d, material: materialRef(d.materialId), plant: plantRef(d.plantId) })),
    codingCandidates: rankCodingCandidates(actions.screenedAt),
    actionCount: countActions(actions),
  }
}

/** The Snapshot as shipped, before anybody touches it. */
export const BASE_SNAPSHOT: I8Snapshot = buildSnapshot(NO_ACTIONS)
