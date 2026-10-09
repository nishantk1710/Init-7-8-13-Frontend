import type { MaterialReference, PlantReference, SAPDocumentReference } from "@demo/lib/domain/contracts"

/**
 * Initiative 8 domain types. These are richer than the shared
 * `contracts.ts` shapes on purpose — cross-initiative code only ever sees
 * `GlobalAction` / `AuditEvent` / `Material360Signal` / `InitiativeSummary`,
 * never these.
 */

/** Where a repair chain sits in its lifecycle. The same stages as live. */
export type RepairStatus =
  | "PR Raised"
  | "PO Issued"
  | "At Vendor"
  | "Received"
  | "Closed"

/** Physical receipt state of the repaired unit(s) back into stores. */
export type ReceiptStatus =
  | "Not Yet Shipped"
  | "Awaiting Receipt"
  | "Partially Received"
  | "Received"

/**
 * Condition-to-repair declaration status. `Flagged` means a declaration covers
 * the line but did not find the part repairable, and it went for repair anyway.
 */
export type DeclarationStatus = "Required" | "Completed" | "Flagged"

export type DeclarationCondition = "Repairable" | "Beyond Economical Repair" | "Scrap"

export type AgingBucket = "0-15" | "16-30" | "31-45" | "46-60" | "60+"

/** Where a repair line stands against its promised return date. */
export type OverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED"

/**
 * Where a repair line stands against the material's planned delivery time — a
 * second signal, independent of `OverdueStatus`. `NO_LEAD_TIME` means there is
 * no benchmark to compare against, not that the line is fine.
 */
export type LeadTimeStatus = "WITHIN_LEAD_TIME" | "BEYOND_LEAD_TIME" | "NO_LEAD_TIME"

/**
 * A single repairable material's active (or recently closed) repair chain —
 * the core entity behind the Repair Register and Repair Detail pages.
 */
export interface RepairChain {
  id: string
  material: MaterialReference
  plant: PlantReference
  stockOnHand: number
  reorderPoint: number
  /** Units physically out for repair right now (0 once received/closed). */
  qtyUnderRepair: number
  repairPR: SAPDocumentReference
  repairPO?: SAPDocumentReference
  vendor: string
  repairStatus: RepairStatus
  receiptStatus: ReceiptStatus
  declarationStatus: DeclarationStatus
  /** Raised to received, or to today while out -- a closed line stops at its receipt. */
  daysOpen: number
  agingBucket: AgingBucket
  /** NORMAL, OBSOLETE, CRITICAL, IMPACT or INSURANCE. Undefined is "not recorded". */
  criticality?: string
  /** The repair's actual duration: raised to received, or to today while out. */
  daysElapsed?: number
  /** Planned delivery time the line is measured against. Undefined when none is maintained. */
  leadTimeDays?: number
  leadTimeStatus?: LeadTimeStatus
  /** Days past the planned delivery time; negative while still inside it. */
  daysOverLeadTime?: number
  /** The repair PO line is blocked in SAP — still counted, flagged on screen. */
  poBlocked?: boolean
  raisedAt: string
  poIssuedAt?: string
  sentToVendorAt?: string
  expectedReturn: string
  /** Negative once the expected-return date has passed. */
  daysRemainingInRepair: number
  receivedAt?: string
  newUnitCost: number
  repairCost: number
  newUnitLeadTimeDays: number
  notes?: string

  // The declaration in full, and the justification -- what the Declaration
  // Queue and Justifications screens showed, folded into the register on
  // 08-Oct-2026. Same fields as live.

  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  /** What a person should do about this line's declaration, in a sentence. */
  declarationNextAction?: string
  requester?: string
  /** Undefined when no reason was recorded while the line was out and no new
   *  purchase overlapped it without one. */
  justification?: RepairJustification
}

/** The register's Justification cell. Same shape as live. */
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

/**
 * One condition-to-repair declaration row. The Declaration Queue screen that
 * rendered these was folded into the register (08-Oct-2026); the rows now
 * reach the register through `data/register.ts`, joined on `relatedRepairId`.
 */
export interface DeclarationItem {
  id: string
  pr: SAPDocumentReference
  material: MaterialReference
  requester: string
  hasActiveRepair: boolean
  relatedRepairId?: string
  /** Units still out on the related repair line — the form's default quantity. */
  quantityUnderRepair?: number
  status: DeclarationStatus
  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  nextAction: string
  createdAt: string
}

/** How loudly an exception should read. */
export type ExceptionSeverity = "info" | "warning" | "critical"

/**
 * One row of the Exception Queue — a finding one of the Initiative 8 checks
 * raised: a repair line sent out with no condition declaration on record, or
 * a new unit bought while a repair for the same material was still open.
 *
 * `type` is a plain string rather than a closed union, mirroring the live
 * contract: a check added later must still render with a readable label.
 */
export interface RepairException {
  id: string
  type: string
  severity: ExceptionSeverity
  material: MaterialReference
  plant: PlantReference
  /** The repair line. For an unjustified acquisition, the repair that was
   *  open when the new unit was bought. */
  repairLine: SAPDocumentReference
  /** The repair chain id, so the row can link into the register detail page. */
  repairId?: string
  /** The new-purchase line. Only unjustified acquisitions carry one. */
  acquisitionLine?: SAPDocumentReference
  title: string
  detail: string
  raisedAt: string
  isOpenRepair: boolean
  /** Raised before Spares Automation existed — a reason, not a violation. */
  preAutomation: boolean
}

/**
 * One PO line whose free text mentioned repair, shown as the evidence behind
 * a coding candidate.
 */
export interface CodingCandidateLine {
  purchasingDocument: string
  item: string
  plant: PlantReference
  /** The text the verdict was reached on, so a cataloguer can check the call
   *  without going back to SAP. */
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
 * One material the coding screen judged (FR-2): its purchase-order free text
 * talks about repair, but the material is not 80-series coded. Advisory only
 * — nothing on this screen changes SAP.
 */
export interface CodingCandidate {
  material: MaterialReference
  /** MISCODED_REPAIRABLE, REPAIR_SERVICE, CONSUMABLE_FOR_REPAIR or UNCLEAR. */
  verdict: string
  /** high / medium / low, as the screen reported it. */
  confidence: string
  /** Why, in the screen's own words. */
  reason: string
  plants: string[]
  lines: CodingCandidateLine[]
  twins: CodingCandidateTwin[]
  /** SAP itself carries the counter-example — the strongest evidence here,
   *  and it owes nothing to the model. */
  isCorroborated: boolean
  /** MISCODED_REPAIRABLE or UNCLEAR — the ones a human should look at. */
  isActionable: boolean
  meetsConfidenceThreshold: boolean
  screenedAt: string
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
  /** The acquisition that was justified. */
  acquisitionLine: SAPDocumentReference
  sessionId?: string
  /** Set when this answers a row on the Exception Queue. */
  exceptionId?: string
}
