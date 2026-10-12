import type { MaterialReference, PlantReference, SAPDocumentReference } from "@demo/lib/domain/contracts"

/**
 * Initiative 8 domain types. These are richer than the shared
 * `contracts.ts` shapes on purpose — cross-initiative code only ever sees
 * `GlobalAction` / `AuditEvent` / `Material360Signal` / `InitiativeSummary`,
 * never these.
 *
 * The Snapshot shows the FRS in full (ruled 12-Oct-2026), so it carries more
 * than live does: the removed / attested / scrapped stages, the reservation and
 * assistant session behind each repair, all four exception types with an owner
 * and a status, and the repairable universe itself.
 */

// ---------------------------------------------------------------------------
// Repair register (FR-3, FR-9)
// ---------------------------------------------------------------------------

/** Where a repair line sits in its lifecycle — the register's Repair Status. */
export type RepairStatus =
  | "PR Raised"
  | "PO Issued"
  | "At Vendor"
  | "Received"
  | "Closed"
  | "Scrapped"

/**
 * The FRS's lifecycle stages (FR-3), in order. A line's timeline walks these;
 * `REMOVED` and `ATTESTED` come before any repair document exists.
 */
export type LifecycleStage =
  | "REMOVED"
  | "ATTESTED"
  | "PR_RAISED"
  | "PO_ISSUED"
  | "AT_VENDOR"
  | "RETURNED"
  | "BACK_IN_STOCK"
  | "SCRAPPED"

/** Physical receipt state of the repaired unit(s) back into stores. */
export type ReceiptStatus =
  | "Not Yet Shipped"
  | "Awaiting Receipt"
  | "Partially Received"
  | "Received"

/**
 * Condition-to-repair declaration status of a repair line. `Flagged` means the
 * declaration did not find the part repairable, and it went for repair anyway.
 */
export type DeclarationStatus = "Required" | "Completed" | "Flagged"

export type DeclarationCondition = "Repairable" | "Beyond Economical Repair" | "Scrap"

export type AgingBucket = "0-15" | "16-30" | "31-45" | "46-60" | "60+"

/** Where a repair line stands against its promised return date plus the grace. */
export type OverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED" | "SCRAPPED"

/**
 * Where a repair line stands against the material's planned delivery time — a
 * second signal, independent of `OverdueStatus`. `NO_LEAD_TIME` means there is
 * no benchmark to compare against, not that the line is fine.
 */
export type LeadTimeStatus = "WITHIN_LEAD_TIME" | "BEYOND_LEAD_TIME" | "NO_LEAD_TIME"

/**
 * One repair line as the fixtures record it: dates and documents only. Every
 * count, band, status and verdict on screen is worked out from these
 * (`model/rules.ts`), so the screens cannot disagree with each other.
 */
export interface RepairLineSeed {
  id: string
  materialId: string
  plantId: string
  vendor: string
  /** Units sent for repair on this line. */
  quantity: number
  /** Units received back so far. Absent is none. */
  quantityReceived?: number
  repairPR: SAPDocumentReference
  repairPO?: SAPDocumentReference
  /** The 80-series reservation that started this repair, and its session. */
  reservation?: SAPDocumentReference
  sessionId?: string
  requester: string
  /** The part came off the machine. */
  removedAt?: string
  prRaisedAt: string
  /** The repair PO line's creation date — the start of the aging clock. */
  poIssuedAt?: string
  /** MSEG 541: transfer to vendor stock. */
  sentToVendorAt?: string
  /** EKET.EINDT. Absent means no schedule line was ever agreed. */
  expectedReturn?: string
  /** First goods receipt (EKBE). */
  receivedAt?: string
  /** Back on the shelf (MARD). */
  backInStockAt?: string
  /** The vendor found it not worth repairing and the line was cancelled. */
  scrappedAt?: string
  /** The repair PO line is blocked in SAP — still counted, flagged on screen. */
  poBlocked?: boolean
  repairCost: number
  notes?: string
}

/** One dated step on a repair line's timeline. */
export interface StageStep {
  stage: LifecycleStage
  at: string
  /** Days from this step to the next one, or to the reference date if current. */
  days: number
  current: boolean
  /** e.g. "1 of 2 received 1 Sep 2026" on an At-vendor step. */
  note?: string
}

/**
 * A repair line as the screens show it — the seed plus everything worked out
 * from it and from the declarations, justifications and exceptions around it.
 */
export interface RepairChain {
  id: string
  material: MaterialReference
  plant: PlantReference
  /** Unrestricted stock today (MARD). Undefined when no MARD row exists. */
  stockOnHand?: number
  /** MARC.MINBE. Undefined when none is maintained. */
  reorderPoint?: number
  /** Units still out: sent, less received, zero once closed or scrapped. */
  qtyUnderRepair: number
  quantity: number
  repairPR: SAPDocumentReference
  repairPO?: SAPDocumentReference
  reservation?: SAPDocumentReference
  sessionId?: string
  vendor: string
  repairStatus: RepairStatus
  receiptStatus: ReceiptStatus
  /** The stage the line is in now, when it entered it, and for how long. */
  stage: LifecycleStage
  stageEnteredAt: string
  daysInStage: number
  stageAgingBucket: AgingBucket
  stages: StageStep[]
  declarationStatus: DeclarationStatus
  /** Raised to received, or to the reference date while out. */
  daysOpen: number
  agingBucket: AgingBucket
  /** CRITICAL, IMPACT, INSURANCE, NORMAL or OBSOLETE. Undefined is "not recorded". */
  criticality?: string
  daysElapsed?: number
  leadTimeDays?: number
  leadTimeStatus?: LeadTimeStatus
  daysOverLeadTime?: number
  poBlocked?: boolean
  removedAt?: string
  raisedAt: string
  poIssuedAt?: string
  sentToVendorAt?: string
  expectedReturn?: string
  overdueStatus: OverdueStatus
  /** Negative once the expected-return date has passed. Undefined with no date. */
  daysRemainingInRepair?: number
  /** Days past the expected return; positive inside the grace too. */
  daysPastDue?: number
  /** Past the expected return but still inside the grace period. */
  inGrace: boolean
  receivedAt?: string
  backInStockAt?: string
  scrappedAt?: string
  /** Dispatch (541) to first goods receipt. Only for lines that came back. */
  turnaroundDays?: number
  newUnitCost: number
  repairCost: number
  newUnitLeadTimeDays: number
  notes?: string
  requester: string
  /** Raised before the declaration control existed — nobody could declare. */
  preAutomation: boolean

  // The declaration that sets the status, and the justification around it.
  declarationId?: string
  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  /** What a person should do about this line's declaration, in a sentence. */
  declarationNextAction?: string
  justification?: RepairJustification
  /** Exceptions on this line still Open or In progress. */
  openExceptionIds: string[]
}

/** The register's Justification cell. */
export type JustificationStatus = "RECORDED" | "MISSING"

/** One justification recorded while the line was out. */
export interface RepairJustificationEntry {
  id?: string
  reasonCategory?: string
  freeText?: string
  author?: string
  recordedAt?: string
  sessionId?: string
}

/** A new unit bought while the line was out, with no reason recorded. */
export interface UnjustifiedPurchase {
  exceptionId: string
  purchase: SAPDocumentReference
  raisedAt?: string
  /** Bought before the justification control existed — nobody was asked. */
  preAutomation: boolean
}

export interface RepairJustification {
  /** MISSING whenever any overlapping purchase has no reason. */
  status: JustificationStatus
  entries: RepairJustificationEntry[]
  unjustifiedPurchases: UnjustifiedPurchase[]
}

// ---------------------------------------------------------------------------
// Repairable universe (FR-1) and the repairable-unit rule (FR-6)
// ---------------------------------------------------------------------------

/** One plant's view of a repairable material: MARD stock and MARC planning. */
export interface MaterialPlantSeed {
  plantId: string
  stockOnHand?: number
  reorderPoint?: number
  /** MARC.PLIFZ, calendar days. */
  plannedDeliveryDays?: number
  /** MARC.DISMM. */
  mrpType?: string
}

/** An 80-series material, as MARA / MAKT / MBEW and the criticality list hold it. */
export interface RepairableMaterialSeed {
  materialId: string
  description: string
  criticality?: string
  /** MBEW unit value, ZAR — what a new unit costs. */
  unitValue: number
  newUnitLeadTimeDays: number
  /** Found in MARA. False when only MARD / MARC / EKPO know it. */
  inMaterialMaster: boolean
  /** MARA.LVORM — flagged for deletion, so out of the universe. */
  deletionFlag?: boolean
  plants: MaterialPlantSeed[]
}

/** Why a repairable unit counts as existing (FR-6). */
export type RepairableUnitBasis = "STOCK" | "OPEN_REPAIR" | "AT_VENDOR_NO_PO"

/** One row of the repairable universe: a material at a plant. */
export interface UniverseRow {
  material: MaterialReference
  plant: PlantReference
  criticality?: string
  stockOnHand?: number
  reorderPoint?: number
  plannedDeliveryDays?: number
  mrpType?: string
  unitValue: number
  inMaterialMaster: boolean
  openRepairLines: number
  qtyUnderRepair: number
  /** Units at a vendor on a 541 with no repair PR or PO behind them. */
  qtyAtVendorNoPo: number
  /** Every reason a repairable unit exists today; empty when none does. */
  repairableUnit: RepairableUnitBasis[]
}

/**
 * A 541 to vendor stock with no repair PR or PO behind it — FR-6(b), read as
 * "stock at a vendor without the paperwork" (the reading the July MSEG
 * extract supports: 16 such rows).
 */
export interface UnpaperedDispatch {
  id: string
  materialDocument: SAPDocumentReference
  materialId: string
  plantId: string
  vendor: string
  quantity: number
  postedAt: string
}

// ---------------------------------------------------------------------------
// Reservations and assistant sessions (FR-5, FR-8)
// ---------------------------------------------------------------------------

/** What the requester did after the assistant answered. */
export type SessionOutcome =
  /** Used the unit on the shelf or waited for the repair — a purchase avoided. */
  | "CHOSE_REPAIR"
  /** Went ahead with a new unit and recorded why. */
  | "BOUGHT_NEW"
  /** Nothing repairable existed, so there was nothing to challenge. */
  | "NO_REPAIRABLE_UNIT"
  /** The session ran past its validity window with no answer. */
  | "ABANDONED"

/** One reservation-time Spares Assistant session. */
export interface AssistantSession {
  /** `S` + 8 characters + 1 check character, as live issues them. */
  id: string
  materialId: string
  plantId: string
  requester: string
  openedAt: string
  quantity: number
  /** What the assistant found when it was asked. */
  basis: RepairableUnitBasis[]
  outcome: SessionOutcome
}

/** An 80-series reservation (RESB) and what its item text carries. */
export interface ReservationSeed {
  reservation: SAPDocumentReference
  materialId: string
  plantId: string
  quantity: number
  requester: string
  createdAt: string
  /** RESB.SGTXT — where the requester is told to type the session id. */
  itemText?: string
}

/** Why a reservation's session reference does or does not hold. */
export type SessionLinkStatus = "VALID" | "MISSING" | "UNKNOWN_SESSION" | "OTHER_PART"

export interface ReservationRow extends ReservationSeed {
  material: MaterialReference
  plant: PlantReference
  sessionLink: SessionLinkStatus
  /** Set only when `sessionLink` is VALID. */
  sessionId?: string
  /** What the item text quoted, when it quoted something. */
  quotedSessionId?: string
  /** The repair line this reservation started, if any. */
  repairId?: string
  preAutomation: boolean
}

// ---------------------------------------------------------------------------
// Condition-to-repair declarations (FR-4)
// ---------------------------------------------------------------------------

/** Where a declaration stands against the register. */
export type DeclarationLink =
  | "MATCHED"
  | "AWAITING_PO"
  | "NOT_FOR_REPAIR"
  | "SENT_ANYWAY"
  | "SCRAPPED"
  | "AMENDED"

/**
 * One condition-to-repair declaration. Recorded against a material and a
 * plant; linked to a repair line and a session explicitly, never by date.
 * Locked once recorded — a change is a new record that supersedes it.
 */
export interface DeclarationRecord {
  id: string
  material: MaterialReference
  plant: PlantReference
  quantity: number
  condition: DeclarationCondition
  faultCategory: string
  conditionDescription: string
  serialNumber?: string
  evidenceReference?: string
  declaredBy: string
  declaredAt: string
  /** Repair lines this declaration sets the Declaration status of. */
  repairLineIds: string[]
  sessionId?: string
  supersedes?: string
  supersededBy?: string
  /** Why the declaration it supersedes was replaced. Required on an amendment. */
  amendmentReason?: string
}

// ---------------------------------------------------------------------------
// New-unit purchases and justifications (FR-7)
// ---------------------------------------------------------------------------

/** A new (not repair) PR or PO line for an 80-series material. */
export interface NewUnitPurchase {
  line: SAPDocumentReference
  materialId: string
  plantId: string
  quantity: number
  raisedAt: string
  /** Who raised it. "MRP" when the planning run did. */
  requester: string
  sessionId?: string
  /** MARD at the moment it was raised, as the check recorded it. */
  stockAtTime: number
}

/** Where a justification was captured. */
export type JustificationSource = "ASSISTANT" | "EXCEPTION"

/**
 * One recorded reason for buying a new unit while a repairable one already
 * existed (FR-7). The log is the denominator for benefit attribution: these
 * are the cases where the assistant's advice was not taken.
 */
export interface JustificationEntry {
  id: string
  material: MaterialReference
  plant: PlantReference
  /** At reservation time, or weeks later when somebody chased the exception
   *  — different kinds of evidence about the same decision. */
  source: JustificationSource
  reasonCategory: string
  freeText: string
  author: string
  recordedAt: string
  /** The purchase that was justified. */
  acquisitionLine: SAPDocumentReference
  sessionId?: string
  reservation?: SAPDocumentReference
  /** Set when this answers a row on the Exception Queue. */
  exceptionId?: string
}

// ---------------------------------------------------------------------------
// Exception queue (FR-8, FR-9, FR-11)
// ---------------------------------------------------------------------------

/** The four exception types the FRS names. */
export type ExceptionType =
  | "OVERDUE_REPAIR"
  | "MISSING_ATTESTATION"
  | "MISSING_SESSION_ID"
  | "UNJUSTIFIED_ACQUISITION"

/** How loudly an exception should read. */
export type ExceptionSeverity = "info" | "warning" | "critical"

/** Where an exception is in its working life. */
export type ExceptionStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"

/** What one check found. Worked out from the data, never typed in. */
export interface ExceptionFinding {
  id: string
  type: ExceptionType
  severity: ExceptionSeverity
  material: MaterialReference
  plant: PlantReference
  title: string
  detail: string
  raisedAt: string
  /** The repair line it concerns, so the row can open it. */
  repairId?: string
  repairLine?: SAPDocumentReference
  /** The new-purchase line. Only unjustified acquisitions carry one. */
  acquisitionLine?: SAPDocumentReference
  reservation?: SAPDocumentReference
  /** Raised before the control existed — a reason, not a violation. */
  preAutomation: boolean
}

export type ExceptionEventKind = "RAISED" | "ASSIGNED" | "COMMENT" | "STATUS" | "AUTO_RESOLVED"

/** One entry in an exception's history. Appended, never edited. */
export interface ExceptionEvent {
  at: string
  actor: string
  kind: ExceptionEventKind
  text: string
  /** Set on STATUS and AUTO_RESOLVED events. */
  status?: ExceptionStatus
  /** Set on ASSIGNED events. */
  owner?: string
}

/** One queue item: the finding, plus who owns it and where it stands. */
export interface RepairException extends ExceptionFinding {
  status: ExceptionStatus
  owner?: string
  /** Still being found by its check today. */
  stillDetected: boolean
  history: ExceptionEvent[]
  resolvedAt?: string
  closedAt?: string
}

// ---------------------------------------------------------------------------
// Coding candidates (FR-2)
// ---------------------------------------------------------------------------

/** Which SAP free text a candidate's evidence came from. */
export type CodingTextSource = "PR" | "PO" | "MOVEMENT"

/** One document line whose free text mentioned repair. */
export interface CodingCandidateLine {
  source: CodingTextSource
  /** EBAN.BANFN / EKPO.EBELN / MSEG.MBLNR. */
  document: string
  item: string
  /** The movement type, for movement text. */
  movementType?: string
  plant: PlantReference
  /** The text the verdict was reached on (TXZ01 or SGTXT). */
  shortText: string
  matchedKeywords: string[]
  raisedAt: string
}

/**
 * An 80-series material carrying the identical text as a coding candidate —
 * SAP's own counter-example, not a model's opinion.
 */
export interface CodingCandidateTwin {
  materialId: string
  sharedText: string
}

/**
 * One material the coding screen judged (FR-2): its PR, PO or movement free
 * text talks about repair, but the material is not 80-series coded. Advisory
 * only — nothing on this screen changes SAP.
 */
export interface CodingCandidate {
  material: MaterialReference
  /** MISCODED_REPAIRABLE, REPAIR_SERVICE, CONSUMABLE_FOR_REPAIR or UNCLEAR. */
  verdict: string
  /** high / medium / low. */
  confidence: string
  /** Why, in the screen's own words. Every row has one: results are kept. */
  reason: string
  lines: CodingCandidateLine[]
  twins: CodingCandidateTwin[]
  screenedAt: string
}

/** A coding candidate with its rank and the flags worked out from it. */
export interface RankedCodingCandidate extends CodingCandidate {
  rank: number
  plants: PlantReference[]
  sources: CodingTextSource[]
  /** SAP itself carries the counter-example. */
  isCorroborated: boolean
  /** MISCODED_REPAIRABLE or UNCLEAR — the ones a human should look at. */
  isActionable: boolean
  meetsConfidenceThreshold: boolean
}
