// Initiative 13 domain types — OAR (Order-As-Required) spares utilization
// tracking. These are intentionally richer than the shared
// `@/lib/domain/contracts` types (which stay generic across initiatives);
// nothing here is imported by any other initiative.

import type {
  MaterialReference,
  PlantReference,
  SAPDocumentReference,
} from "@/lib/domain/contracts"

/** Where a ledger line currently sits in the RR -> ... -> utilization flow. */
export type LedgerStage =
  | "Requested"
  | "Reserved"
  | "PR Raised"
  | "PO Raised"
  | "Goods Receipt"
  | "Goods Issued"
  | "Utilization Confirmed"
  | "Available for Redeployment"

export type ExceptionType =
  | "None"
  | "Consumption Overdue"
  | "No Longer Required"

/** One requester/approver reference — always sourced from `@/lib/shared-data/users`. */
export interface OARPersonRef {
  userId: string
  name: string
  role: string
}

/** One step in the RR -> Reservation -> PR -> PO -> GR -> GI -> Confirmation chain. */
export interface DocumentChainStep {
  id: string
  stage: LedgerStage | "Requested" | "Re-planned" | "No Longer Required"
  doc?: SAPDocumentReference
  timestamp: string
  description: string
  tone?: "default" | "success" | "warning" | "danger"
}

export interface UtilizationLedgerLine {
  id: string
  trackingId: string
  reservation: SAPDocumentReference
  material: MaterialReference
  unitPrice: number
  requester: OARPersonRef
  department: string
  plant: PlantReference
  purpose: string
  project?: string
  jobWorkOrder?: string
  equipment?: string
  plannedConsumptionDate: string
  qtyRequested: number
  qtyReceived: number
  qtyIssued: number
  qtyConfirmedUsed: number
  uom: string
  stage: LedgerStage
  agingDays: number
  exception: ExceptionType
  documentChain: DocumentChainStep[]
  /** Set on lines that roll up into a shared PR/PO (Scenario H). */
  allocationMethod?: string
  consolidatedGroupId?: string
  /** Set once a line has been re-planned at least once. */
  replanReason?: string
  replanNewDate?: string
}

export interface EscalationTimelineEvent {
  id: string
  label: string
  timestamp: string
  description?: string
  tone?: "default" | "success" | "warning" | "danger"
}

export interface RedeploymentMatch {
  plant: PlantReference
  qtyAvailable: number
  lastMovementDate: string
  condition: string
}

export interface RedeploymentCandidate {
  id: string
  material: MaterialReference
  requestingPlant: PlantReference
  qtyNeeded: number
  requestedFor: string
  sourceLedgerLineId?: string
  matches: RedeploymentMatch[]
}

export interface ReclassificationCandidate {
  id: string
  material: MaterialReference
  consumptionFrequency: string
  annualRequests: number
  annualIssues: number
  sites: number
  utilizationRate: number
  recommendation: string
}
