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
 * Where a repair line stands against its promised return date.
 *
 * Served by `GET /api/i8/register` as `overdueStatus`. It exists because
 * "not overdue" and "nobody ever agreed a date" are different answers, and
 * collapsing them hides exactly the lines that need chasing — 63 of the 1,225
 * repair lines in the July extract have no schedule line at all.
 *
 * Prefer `isRepairOverdue()` in `utils/status.ts` over comparing
 * `daysRemainingInRepair` directly: that field is now optional, and
 * `undefined < 0` is `false`, which would silently mark an undated line as
 * on time.
 */
export type OverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED"

/**
 * A single repairable material's active (or recently closed) repair chain —
 * the core entity behind the Repair Register / Repair Detail / Duplicate
 * Guard pages.
 */
export interface RepairChain {
  id: string
  material: MaterialReference
  plant: PlantReference

  /**
   * Unrestricted stock on hand, summed across storage locations.
   *
   * Optional: the backend returns null when the material has no MARD row.
   * That is "we do not know", which is not the same as zero stock — and zero
   * stock is what triggers a duplicate purchase, so the two must not be
   * conflated.
   */
  stockOnHand?: number

  /**
   * Optional, and undefined far more often than you would expect: the MARC
   * extract covers plants 1300 and 1200 only, so **every Gamsberg material
   * has no reorder point at all**. Rendering a missing one as 0 would read as
   * "never reorder this", which is a worse answer than "unknown".
   */
  reorderPoint?: number

  /** Units physically out for repair right now (0 once received/closed). */
  qtyUnderRepair: number
  repairPR: SAPDocumentReference
  repairPO?: SAPDocumentReference

  /**
   * Optional: the vendor comes from the purchase-order header, and 455 of the
   * 1,225 repair lines have no header in the July extract (EKKO starts
   * 07-Jan-2025; EKPO reaches further back). Undefined means "not known from
   * this data" — an empty string would read as a vendor whose name is blank.
   *
   * When it is a bare SAP vendor code, `vendorName` carries the display name
   * if LFA1 knows it. It usually does not: only 4 of the 61 repair vendors in
   * the extract resolve to a name.
   */
  vendor?: string

  /** Display name for `vendor`, when the vendor master knows it. */
  vendorName?: string

  repairStatus: RepairStatus
  receiptStatus: ReceiptStatus
  declarationStatus: DeclarationStatus

  /**
   * Where this line stands against its promised date. Authoritative when
   * present — use `isRepairOverdue()` rather than reading it directly, so the
   * mock-data path keeps working.
   */
  overdueStatus?: OverdueStatus

  /** Days since the repair PR was raised. */
  daysOpen: number
  agingBucket: AgingBucket
  raisedAt: string
  poIssuedAt?: string
  sentToVendorAt?: string

  /**
   * Optional: 63 of the 1,225 repair lines have no schedule line in SAP, so no
   * return date was ever agreed. Those are the lines nobody is chasing, which
   * is precisely why a placeholder date must not be invented for them — they
   * come through as `overdueStatus: "NO_DUE_DATE"`.
   */
  expectedReturn?: string

  /**
   * Negative once the expected-return date has passed. Undefined when there is
   * no expected return to count towards.
   *
   * Do not test this with `< 0` to mean overdue: `undefined < 0` is `false`,
   * so an undated line would silently read as on time. Use `isRepairOverdue()`.
   */
  daysRemainingInRepair?: number

  receivedAt?: string

  /**
   * Optional: no valuation source is in Initiative 8's table set (MBEW was
   * extracted for I07 and I13), so live data does not carry it. Sending 0
   * would make every repair look infinitely worth doing.
   */
  newUnitCost?: number

  repairCost: number

  /**
   * Lead time to buy a NEW one — the number that makes waiting for a repair
   * worth it.
   *
   * Optional, and undefined on **357 of the 1,225 repair lines**: it comes from
   * the MARC planning extract, which covers plants 1300 and 1200 only, so every
   * Gamsberg line has none. Exactly the same gap as `reorderPoint`, measured on
   * exactly the same rows.
   *
   * Rendering it as 0 would read as "a new one arrives immediately", which is
   * the most persuasive possible argument against repairing anything.
   */
  newUnitLeadTimeDays?: number
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
