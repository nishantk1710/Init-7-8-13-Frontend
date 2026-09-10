import type { MaterialReference, PlantReference, SAPDocumentReference } from "@/lib/domain/contracts"

/**
 * Initiative 8 domain types. These are richer than the shared
 * `contracts.ts` shapes on purpose — cross-initiative code only ever sees
 * `GlobalAction` / `AuditEvent` / `Material360Signal` / `InitiativeSummary`,
 * never these.
 */

/** Where a repair chain sits in its lifecycle. */
export type RepairStatus =
  | "PR Raised"
  | "PO Issued"
  | "At Vendor"
  | "In Transit Return"
  | "Received"
  | "Closed"

/** Physical receipt state of the repaired unit(s) back into stores. */
export type ReceiptStatus =
  | "Not Yet Shipped"
  | "Awaiting Receipt"
  | "Partially Received"
  | "Received"

/**
 * Condition-to-repair declaration status — a mandatory workflow, tracked
 * separately from the advisory Duplicate Guard check.
 */
export type DeclarationStatus = "Required" | "Pending" | "Completed" | "Flagged"

export type DeclarationCondition = "Repairable" | "Beyond Economical Repair" | "Scrap"

/** How a procurement request originated. */
export type DeclarationSource = "Manual" | "MRP-generated"

export type AgingBucket = "0-15" | "16-30" | "31-45" | "46-60" | "60+"

/**
 * A single repairable material's active (or recently closed) repair chain —
 * the core entity behind the Repair Register / Repair Detail / Duplicate
 * Guard pages.
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
  /** Days since the repair PR was raised. */
  daysOpen: number
  agingBucket: AgingBucket
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
}

/** One row in the mandatory Condition-to-Repair Declaration Queue. */
export interface DeclarationItem {
  id: string
  pr: SAPDocumentReference
  material: MaterialReference
  requester: string
  source: DeclarationSource
  hasActiveRepair: boolean
  relatedRepairId?: string
  status: DeclarationStatus
  declaredBy?: string
  declaredAt?: string
  condition?: DeclarationCondition
  nextAction: string
  createdAt: string
}
