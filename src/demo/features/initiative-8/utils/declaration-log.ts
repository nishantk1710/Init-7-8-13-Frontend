import { ALL } from "@demo/features/initiative-8/model/metrics"
import type {
  DeclarationLink,
  DeclarationRecord,
  RepairChain,
} from "@demo/features/initiative-8/types/repair"
import { codeLabel, type Tone } from "@demo/features/initiative-8/utils/status"

/**
 * The Declarations screen's rules (FR-4), as plain functions over
 * `DeclarationRecord[]` — testable without React, and shared by the table and
 * its CSV so the two can never disagree about which rows a filter matches.
 */

/** Repair lines by id, so a declaration can read the lines it names. */
export type LinesById = ReadonlyMap<string, Pick<RepairChain, "repairStatus">>

/**
 * Where a declaration stands against the register.
 *
 * Read off the declaration's own explicit link (`repairLineIds`), never
 * matched by date: a "Matched" here is exactly a Completed line in the
 * register, a "Sent for repair anyway" exactly a Flagged one, and the two
 * screens cannot drift apart. A line that was scrapped means the assessment
 * and the outcome agree, whatever the condition said.
 */
export function declarationLinkOf(record: DeclarationRecord, linesById: LinesById): DeclarationLink {
  if (record.supersededBy) return "AMENDED"
  if (record.repairLineIds.length === 0) {
    return record.condition === "Repairable" ? "AWAITING_PO" : "NOT_FOR_REPAIR"
  }
  if (record.repairLineIds.some((id) => linesById.get(id)?.repairStatus === "Scrapped")) return "SCRAPPED"
  return record.condition === "Repairable" ? "MATCHED" : "SENT_ANYWAY"
}

/** The link states, in the order the filter offers them. */
export const DECLARATION_LINKS: readonly DeclarationLink[] = [
  "AWAITING_PO",
  "MATCHED",
  "NOT_FOR_REPAIR",
  "SENT_ANYWAY",
  "SCRAPPED",
  "AMENDED",
]

export const DECLARATION_LINK_LABEL: Record<DeclarationLink, string> = {
  MATCHED: "Covers repair line",
  AWAITING_PO: "Awaiting repair PO",
  NOT_FOR_REPAIR: "Not for repair",
  SENT_ANYWAY: "Sent for repair anyway",
  SCRAPPED: "Line scrapped",
  AMENDED: "Amended",
}

export const DECLARATION_LINK_NOTE: Record<DeclarationLink, string> = {
  MATCHED:
    "Names the repair line it covers; that line's Declaration status reads Completed.",
  AWAITING_PO:
    "Assessed repairable and no repair line named yet — the normal state for a part declared before it is sent for repair.",
  NOT_FOR_REPAIR:
    "Assessed as not worth repairing, and no repair line has been raised for it: the repair spend this declaration avoided.",
  SENT_ANYWAY:
    "Assessed as not worth repairing, yet a repair line was raised for it; that line's Declaration status reads Flagged.",
  SCRAPPED:
    "The repair line it names was cancelled and the unit scrapped — the assessment and the outcome agree; the line reads Completed.",
  AMENDED: "Replaced by a later declaration. Kept, unchanged, as the audit trail.",
}

export const DECLARATION_LINK_TONE: Record<DeclarationLink, Tone> = {
  MATCHED: "success",
  AWAITING_PO: "default",
  NOT_FOR_REPAIR: "default",
  SENT_ANYWAY: "danger",
  SCRAPPED: "default",
  AMENDED: "default",
}

export type DeclarationLogFilters = {
  plant: string
  condition: string
  link: string
  /** Material, description, declaration id, repair line or session — case-insensitive. */
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
  linesById: LinesById,
): DeclarationRecord[] {
  const needle = filters.search.trim().toLowerCase()
  return records.filter((r) => {
    if (filters.plant !== ALL && r.plant.plantId !== filters.plant) return false
    if (filters.condition !== ALL && r.condition !== filters.condition) return false
    if (filters.link !== ALL && declarationLinkOf(r, linesById) !== filters.link) return false
    if (needle) {
      const haystack = [
        r.id,
        r.material.materialId,
        r.material.description,
        r.sessionId ?? "",
        ...r.repairLineIds,
      ]
      if (!haystack.some((value) => value.toLowerCase().includes(needle))) return false
    }
    return true
  })
}

export type DeclarationSummary = {
  /** Declarations in force — amended ones are history, not counted again. */
  current: number
  repairable: number
  /** Beyond Economical Repair or Scrap. */
  notRepairable: number
  awaitingPo: number
  notForRepair: number
  sentAnyway: number
  /** Records replaced by a later amendment. */
  amended: number
}

/** The figures above the table. Every one but `amended` counts declarations in force. */
export function summariseDeclarations(
  records: DeclarationRecord[],
  linesById: LinesById,
): DeclarationSummary {
  const summary: DeclarationSummary = {
    current: 0,
    repairable: 0,
    notRepairable: 0,
    awaitingPo: 0,
    notForRepair: 0,
    sentAnyway: 0,
    amended: 0,
  }
  for (const record of records) {
    const link = declarationLinkOf(record, linesById)
    if (link === "AMENDED") {
      summary.amended += 1
      continue
    }
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
  "Evidence reference",
  "Repair line status",
  "Repair lines",
  "Session",
  "Supersedes",
  "Superseded by",
  "Amendment reason",
]

/** One CSV row per record handed in — already filtered, so the file is the
 *  view it came from. Absent values are empty cells. */
export function declarationRowsToCsv(
  records: DeclarationRecord[],
  linesById: LinesById,
): (string | number)[][] {
  return records.map((r) => [
    r.id,
    r.declaredAt,
    r.declaredBy,
    r.material.materialId,
    r.material.description,
    `${r.plant.plantId} ${r.plant.name}`,
    r.quantity,
    r.condition,
    codeLabel(r.faultCategory),
    r.conditionDescription,
    r.serialNumber ?? "",
    r.evidenceReference ?? "",
    DECLARATION_LINK_LABEL[declarationLinkOf(r, linesById)],
    r.repairLineIds.join(" "),
    r.sessionId ?? "",
    r.supersedes ?? "",
    r.supersededBy ?? "",
    r.amendmentReason ?? "",
  ])
}
