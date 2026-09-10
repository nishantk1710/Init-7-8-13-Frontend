// W2.6b — Initiative 8: SAP + platform rows -> the RepairChain view model.

import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { SapRow } from "../client/decode-row"
import { loadPlatform, type PlatformRow } from "./platform-source"
import { plantRef } from "./reference-data"
import type { FieldSourceMap } from "./field-source"

export const REPAIR_CHAIN_SOURCES: FieldSourceMap<RepairChain> = {
  id: { from: "platform", file: "repair_cases", column: "case_id" },
  material: {
    from: "sap",
    entitySet: "MaterialSet",
    property: "Matnr",
    note: "description joined from MaterialDescriptionSet.Maktx",
  },
  plant: {
    from: "sap",
    entitySet: "MaterialPlantSet",
    property: "Werks",
    note: "the CODE is real; the site NAME is not - see reference-data.ts",
  },
  repairPR: { from: "platform", file: "repair_cases", column: "repair_pr" },
  repairPO: { from: "platform", file: "repair_cases", column: "repair_po/repair_po_item" },
  repairStatus: { from: "platform", file: "repair_cases", column: "stage" },
  raisedAt: { from: "platform", file: "repair_cases", column: "removed_on" },
  expectedReturn: { from: "platform", file: "repair_cases", column: "expected_back_on" },
  receivedAt: { from: "platform", file: "repair_cases", column: "returned_on" },
  notes: { from: "platform", file: "repair_cases", column: "notes" },
  declarationStatus: {
    from: "platform",
    file: "repair_attestations",
    column: "attestation_id",
    note: "present and complete -> Completed; missing -> Required",
  },
  reorderPoint: { from: "sap", entitySet: "MaterialPlantSet", property: "Minbe" },
  stockOnHand: {
    from: "sap",
    entitySet: "StorageLocationStockSet",
    property: "Labst",
    note: "unrestricted stock summed across storage locations for the plant",
  },
  vendor: {
    from: "sap",
    entitySet: "PurchaseOrderSet",
    property: "Lifnr",
    note: "vendor on the repair PO, joined to VendorSet.Name1 for a display name",
  },
  newUnitLeadTimeDays: { from: "sap", entitySet: "MaterialPlantSet", property: "Plifz" },
  daysOpen: { from: "derived", note: "days between raisedAt and today" },
  daysRemainingInRepair: { from: "derived", note: "days between today and expectedReturn; negative once overdue" },
  agingBucket: { from: "derived", note: "daysOpen bucketed into 0-15 / 16-30 / 31-45 / 46-60 / 60+" },
  qtyUnderRepair: { from: "derived", note: "repair PO quantity, zero once the case reaches BACK_IN_STOCK" },
  receiptStatus: { from: "derived", note: "from the repair case stage plus returned_on" },
  repairCost: {
    from: "blocked",
    entitySet: "PurchaseOrderItemSet",
    property: "Netwr",
    note: "the repair PO's net value. Live today, but Netwr is Edm.String and must be parsed, never coerced by shape",
  },
  newUnitCost: {
    from: "blocked",
    entitySet: "MaterialValuationSet",
    property: "Stprs",
    note: "standard price of a new unit; MaterialValuationSet returns zero rows live (§1.3)",
  },
  poIssuedAt: {
    from: "blocked",
    entitySet: "PurchaseOrderSet",
    property: "Aedat",
    note: "PO creation date; joinable once repair POs are read live rather than from the fixture",
  },
  sentToVendorAt: {
    from: "gap",
    note: "Date the unit physically left for the vendor. No SAP field and no platform column carries it — it would come from a goods-issue movement whose movement type is still an unconfirmed business constant (D7).",
  },
}

export interface Initiative8Input {
  cases: PlatformRow[]
  attestations: PlatformRow[]
  materialPlants: Map<string, SapRow>
  descriptions: Map<string, string>
  /** PurchaseOrderSet keyed by Ebeln — carries the repair PO's vendor and creation date. */
  purchaseOrders?: Map<string, SapRow>
  /** VendorSet keyed by Lifnr, for a display name rather than a number. */
  vendors?: Map<string, SapRow>
  /** PurchaseOrderItemSet keyed by `Ebeln|Ebelp` — carries the repair cost. */
  purchaseOrderItems?: Map<string, SapRow>
  /** Unrestricted stock summed per `Matnr|Werks` from StorageLocationStockSet. */
  stockOnHand?: Map<string, number>
}

const numberOf = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const daysBetween = (from: string, to: Date): number => {
  if (!from) return 0
  const start = new Date(from)
  if (Number.isNaN(start.getTime())) return 0
  return Math.round((to.getTime() - start.getTime()) / 86_400_000)
}

/** Decoded Edm.DateTime arrives as a Date; the view models carry ISO date strings. */
function formatDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "string" && value) return value.slice(0, 10)
  return undefined
}

function agingBucketFor(days: number): RepairChain["agingBucket"] {
  if (days <= 15) return "0-15"
  if (days <= 30) return "16-30"
  if (days <= 45) return "31-45"
  if (days <= 60) return "46-60"
  return "60+"
}

function repairStatusFor(stage: string): RepairChain["repairStatus"] {
  switch (stage) {
    case "PR_RAISED":
      return "PR Raised"
    case "PO_ISSUED":
      return "PO Issued"
    case "AT_VENDOR":
      return "At Vendor"
    case "IN_TRANSIT_RETURN":
      return "In Transit Return"
    case "BACK_IN_STOCK":
      return "Received"
    case "CLOSED":
      return "Closed"
    default:
      return "PR Raised"
  }
}

function receiptStatusFor(stage: string, returnedOn: string): RepairChain["receiptStatus"] {
  if (returnedOn) return "Received"
  if (stage === "IN_TRANSIT_RETURN") return "Awaiting Receipt"
  if (stage === "PR_RAISED") return "Not Yet Shipped"
  return "Awaiting Receipt"
}

export function mapRepairChain(row: PlatformRow, input: Initiative8Input, asOf = new Date()): RepairChain {
  const plant = input.materialPlants.get(`${row.Matnr}|${row.Werks}`) ?? {}
  const daysOpen = daysBetween(row.removed_on, asOf)
  const attestation = input.attestations.find((a) => a.attestation_id === row.attestation_id)

  const purchaseOrder = row.repair_po ? input.purchaseOrders?.get(row.repair_po) : undefined
  const vendorNumber = purchaseOrder ? String(purchaseOrder.Lifnr ?? "") : ""
  const vendor = vendorNumber ? input.vendors?.get(vendorNumber) : undefined
  const poItem = row.repair_po ? input.purchaseOrderItems?.get(`${row.repair_po}|${row.repair_po_item}`) : undefined

  return {
    id: row.case_id,
    material: {
      materialId: row.Matnr,
      materialCode: row.Matnr,
      description: input.descriptions.get(row.Matnr) ?? "",
    },
    plant: plantRef(row.Werks),
    repairPR: { type: "PR", documentNumber: row.repair_pr },
    repairPO: row.repair_po
      ? { type: "PO", documentNumber: row.repair_po, line: row.repair_po_item }
      : undefined,
    repairStatus: repairStatusFor(row.stage),
    receiptStatus: receiptStatusFor(row.stage, row.returned_on),
    declarationStatus: attestation ? "Completed" : "Required",
    raisedAt: row.removed_on,
    expectedReturn: row.expected_back_on,
    receivedAt: row.returned_on || undefined,
    notes: row.notes || undefined,
    daysOpen,
    agingBucket: agingBucketFor(daysOpen),
    daysRemainingInRepair: row.expected_back_on ? -daysBetween(row.expected_back_on, asOf) : 0,
    qtyUnderRepair: row.stage === "BACK_IN_STOCK" || row.stage === "CLOSED" ? 0 : 1,
    reorderPoint: numberOf(plant.Minbe),
    newUnitLeadTimeDays: numberOf(plant.Plifz),

    stockOnHand: input.stockOnHand?.get(`${row.Matnr}|${row.Werks}`) ?? 0,
    vendor: vendor ? String(vendor.Name1 ?? vendorNumber) : vendorNumber,
    // Netwr is Edm.String — parsed here, never coerced by shape (§1.2).
    repairCost: poItem ? numberOf(poItem.Netwr) : 0,
    poIssuedAt: purchaseOrder ? formatDate(purchaseOrder.Aedat) : undefined,

    // Blocked or gapped — see REPAIR_CHAIN_SOURCES. Deliberately not invented.
    newUnitCost: 0,
    sentToVendorAt: undefined,
  }
}

export function loadInitiative8Platform(): Initiative8Input["cases"] {
  return loadPlatform("repair_cases")
}
