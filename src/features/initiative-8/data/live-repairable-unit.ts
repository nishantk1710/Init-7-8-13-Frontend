/**
 * The Duplicate Guard's question — `GET /api/i8/repairable-unit` (FR-6).
 *
 * "Before somebody buys a new one: is there already a repairable unit of this
 * material at this plant, in stock or on a repair order?" The backend answers
 * with a sentence (`headline`), the numbers behind it, the open repair lines it
 * rests on, and `caveats` — what the answer does NOT prove. All four go on
 * screen. A "yes" without its caveats overstates what SAP can show: a repair PO
 * existing is not evidence the unit ever reached the vendor.
 *
 * Advisory only. Nothing here blocks a request or writes anywhere.
 */

import { formatApiDate, getRepairableUnit, toNumber } from "@/lib/api/i8"
import type { ApiRepairableUnit, ApiRepairableUnitEvidence } from "@/lib/api/i8"
import type { SAPDocumentReference } from "@/lib/domain/contracts"

/** A real open, overdue repair — the default, so the page opens on a "yes". */
export const DEFAULT_MATERIAL = "8000004665"
export const DEFAULT_PLANT = "1300"

/**
 * The two plants the platform covers. Hard-coded on purpose: the attestation
 * endpoint rejects any other, and the names are the ones the backend serves.
 */
export const GUARD_PLANTS = [
  { plantId: "1300", name: "Black Mountain Mining" },
  { plantId: "1500", name: "Gamsberg" },
]

/** Real materials, one per answer the check can give. */
export const GUARD_EXAMPLES = [
  { material: "8000004665", plant: "1300", label: "open, overdue repair" },
  { material: "8000000003", plant: "1300", label: "in stock" },
  { material: "8000000000", plant: "1300", label: "nothing" },
]

const SOURCE_LABEL: Record<string, string> = {
  STOCK: "In stock",
  ON_REPAIR_ORDER: "On repair order",
}

export type RepairableUnitEvidence = {
  /** `{EBELN}-{EBELP}`, the register detail route's id. */
  id: string
  repairPO: SAPDocumentReference
  quantity?: number
  raisedAt?: string
  dueDate?: string
  /** Positive once past the promised date; undefined when none was agreed. */
  daysOverdue?: number
  vendor: string
  status: string
  dispatched: boolean
}

export type RepairableUnitAnswer = {
  materialId: string
  plant: string
  isRepairableMaterial: boolean
  exists: boolean
  /** Display labels, in the order the backend sent them. */
  sources: string[]
  /** Undefined when there is no stock record — unknown, never zero. */
  stockOnHand?: number
  stockLocations: number
  openRepairLines: number
  quantityUnderRepair: number
  soonestDueDate?: string
  overdueLines: number
  headline: string
  caveats: string[]
  evidence: RepairableUnitEvidence[]
  referenceDate: string
}

function toEvidence(row: ApiRepairableUnitEvidence): RepairableUnitEvidence {
  return {
    id: `${row.purchasingDocument}-${row.item}`,
    repairPO: { type: "PO", documentNumber: row.purchasingDocument, line: row.item },
    quantity: toNumber(row.quantity),
    raisedAt: row.raisedAt ? formatApiDate(row.raisedAt) : undefined,
    dueDate: row.dueDate ? formatApiDate(row.dueDate) : undefined,
    daysOverdue: row.daysOverdue ?? undefined,
    // Same fallback chain as the register's vendorLabel: a name when LFA1
    // knows it, the code when it does not, and a plain admission otherwise.
    vendor: row.vendorName ?? row.vendor ?? "Unknown vendor",
    status: row.status,
    dispatched: row.dispatched,
  }
}

export function toRepairableUnit(body: ApiRepairableUnit): RepairableUnitAnswer {
  return {
    materialId: body.materialId,
    plant: body.plant,
    isRepairableMaterial: body.isRepairableMaterial,
    exists: body.exists,
    sources: body.sources.map((source) => SOURCE_LABEL[source] ?? source),
    // stockIsUnknown wins over whatever stockOnHand says: "no stock record" is
    // exactly the case where a 0 would talk somebody into a duplicate purchase.
    stockOnHand: body.stockIsUnknown ? undefined : toNumber(body.stockOnHand),
    stockLocations: body.stockLocations,
    openRepairLines: body.openRepairLines,
    quantityUnderRepair: toNumber(body.quantityUnderRepair) ?? 0,
    soonestDueDate: body.soonestDueDate ? formatApiDate(body.soonestDueDate) : undefined,
    overdueLines: body.overdueLines,
    headline: body.headline,
    caveats: body.caveats,
    evidence: body.evidence.map(toEvidence),
    referenceDate: body.referenceDate,
  }
}

/**
 * The banner for an answer. A unit existing is a warning — that is the
 * duplicate this screen is here to catch. Everything else is information,
 * including "not a repairable material": nothing to guard, not a fault.
 */
export function repairableUnitVerdict(answer: RepairableUnitAnswer): {
  tone: "warning" | "info"
  title: string
} {
  if (!answer.isRepairableMaterial) {
    return { tone: "info", title: "Not a repairable material" }
  }
  if (answer.exists) {
    return { tone: "warning", title: "A repairable unit already exists" }
  }
  return { tone: "info", title: "No repairable unit found" }
}

/** Ask the backend. Throws on a failed request — the caller must show that as
 *  a failure, never as "no unit found". */
export async function loadRepairableUnit(
  material: string,
  plant: string,
): Promise<RepairableUnitAnswer> {
  return toRepairableUnit(await getRepairableUnit({ material: material.trim(), plant }))
}
