import type {
  DeclarationCondition,
  DeclarationLink,
  DeclarationRecord,
} from "@/features/initiative-8/types/repair"
import { ALL } from "@/features/initiative-8/utils/register-view"

/**
 * The Declarations screen's rules (FR-4), as plain functions over
 * `DeclarationRecord[]` -- testable without React, and shared by the table and
 * its CSV so the two can never disagree about which rows a filter matches.
 */

type Tone = "default" | "success" | "warning" | "danger"

/**
 * Where a declaration stands against the register.
 *
 * Read off the backend's own match (`repairLineIds`), never re-derived here:
 * a "Matched" on this screen is exactly a Completed or Flagged line in the
 * register, and the two screens cannot drift apart.
 */
export function declarationLinkOf(record: DeclarationRecord): DeclarationLink {
  if (record.supersededBy) return "AMENDED"
  const matched = record.repairLineIds.length > 0
  if (record.condition === "Repairable") return matched ? "MATCHED" : "AWAITING_PO"
  return matched ? "SENT_ANYWAY" : "NOT_FOR_REPAIR"
}

/** The link states, in the order the filter offers them. */
export const DECLARATION_LINKS: readonly DeclarationLink[] = [
  "AWAITING_PO",
  "MATCHED",
  "NOT_FOR_REPAIR",
  "SENT_ANYWAY",
  "AMENDED",
]

export const DECLARATION_LINK_LABEL: Record<DeclarationLink, string> = {
  MATCHED: "Matched to repair PO",
  AWAITING_PO: "Awaiting repair PO",
  NOT_FOR_REPAIR: "Not for repair",
  SENT_ANYWAY: "Sent for repair anyway",
  AMENDED: "Amended",
}

export const DECLARATION_LINK_NOTE: Record<DeclarationLink, string> = {
  MATCHED:
    "A repair PO line for this part and plant has picked this declaration up; that line's Declaration status reads Completed.",
  AWAITING_PO:
    "No repair PO line for this part and plant has picked this declaration up yet — the normal state for a part declared before it is sent for repair.",
  NOT_FOR_REPAIR:
    "Assessed as not worth repairing, and no repair PO line has been raised for it: the repair spend this declaration avoided.",
  SENT_ANYWAY:
    "Assessed as not worth repairing, yet a repair PO line picked it up; that line's Declaration status reads Flagged.",
  AMENDED: "Replaced by a later declaration. Kept, unchanged, as the audit trail.",
}

export const DECLARATION_LINK_TONE: Record<DeclarationLink, Tone> = {
  MATCHED: "success",
  AWAITING_PO: "default",
  NOT_FOR_REPAIR: "default",
  SENT_ANYWAY: "danger",
  AMENDED: "default",
}

export const DECLARATION_CONDITION_TONE: Record<DeclarationCondition, Tone> = {
  Repairable: "success",
  "Beyond Economical Repair": "warning",
  Scrap: "danger",
}

export type DeclarationLogFilters = {
  plant: string
  condition: string
  link: string
  /** Material number or description, case-insensitive. Blank matches all. */
  search: string
}

export const NO_DECLARATION_FILTERS: DeclarationLogFilters = {
  plant: ALL,
  condition: ALL,
  link: ALL,
  search: "",
}

/** The rows matching every active filter. */
export function filterDeclarations(
  records: DeclarationRecord[],
  filters: DeclarationLogFilters,
): DeclarationRecord[] {
  const needle = filters.search.trim().toLowerCase()
  return records.filter((r) => {
    if (filters.plant !== ALL && r.plant.plantId !== filters.plant) return false
    if (filters.condition !== ALL && r.condition !== filters.condition) return false
    if (filters.link !== ALL && declarationLinkOf(r) !== filters.link) return false
    if (
      needle &&
      !r.material.materialId.toLowerCase().includes(needle) &&
      !r.material.description.toLowerCase().includes(needle)
    ) {
      return false
    }
    return true
  })
}

export type DeclarationSummary = {
  /** Declarations in force -- amended ones are history, not counted again. */
  current: number
  repairable: number
  /** Beyond Economical Repair or Scrap. */
  notRepairable: number
  awaitingPo: number
  notForRepair: number
  sentAnyway: number
}

/** The figures above the table. Every one counts current declarations only. */
export function summariseDeclarations(records: DeclarationRecord[]): DeclarationSummary {
  const summary: DeclarationSummary = {
    current: 0,
    repairable: 0,
    notRepairable: 0,
    awaitingPo: 0,
    notForRepair: 0,
    sentAnyway: 0,
  }
  for (const record of records) {
    const link = declarationLinkOf(record)
    if (link === "AMENDED") continue
    summary.current += 1
    if (record.condition === "Repairable") summary.repairable += 1
    else summary.notRepairable += 1
    if (link === "AWAITING_PO") summary.awaitingPo += 1
    if (link === "NOT_FOR_REPAIR") summary.notForRepair += 1
    if (link === "SENT_ANYWAY") summary.sentAnyway += 1
  }
  return summary
}

export const DECLARATION_CSV_HEADERS = [
  "Declaration",
  "Declared at",
  "Declared by",
  "Material",
  "Description",
  "Plant",
  "Quantity",
  "Condition",
  "Fault category",
  "Condition description",
  "Serial number",
  "Evidence",
  "Repair line status",
  "Repair lines",
  "Supersedes",
  "Superseded by",
]

/** One CSV row per record handed in -- already filtered, so the file is the
 *  view it came from. Absent values are empty cells. */
export function declarationRowsToCsv(records: DeclarationRecord[]): (string | number)[][] {
  return records.map((r) => [
    r.id,
    r.declaredAt,
    r.declaredBy,
    r.material.materialCode,
    r.material.description,
    `${r.plant.plantId} ${r.plant.name}`,
    r.quantity,
    r.condition,
    faultCategoryLabel(r.faultCategory),
    r.conditionDescription,
    r.serialNumber ?? "",
    r.evidenceReference ?? "",
    DECLARATION_LINK_LABEL[declarationLinkOf(r)],
    r.repairLineIds.join(" "),
    r.supersedes ?? "",
    r.supersededBy ?? "",
  ])
}

/** A fault category as words: `BEARING_FAILURE` -> "bearing failure". */
export function faultCategoryLabel(category: string): string {
  return category.replace(/_/g, " ").toLowerCase()
}
