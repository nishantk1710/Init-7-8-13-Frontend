/**
 * The live exception queue — `GET /api/i8/exceptions`.
 *
 * Two checks raise rows today:
 *
 *   MISSING_ATTESTATION      a repair line went out with no condition assessment
 *                            on record. Every historical line raises it, because
 *                            until this platform there was nowhere to record one.
 *   UNJUSTIFIED_ACQUISITION  a new 80-series unit was bought while a repair of
 *                            the same material and plant was open, and no
 *                            NEW_ACQUISITION justification was recorded. The
 *                            repair line is the one that was open; the new
 *                            purchase is `acquisitionLine`.
 *
 * The backend declares more types than it raises, and will add more. So `type`
 * stays a string all the way to the screen, and a type this build has never
 * seen renders with a humanised label and a neutral tone instead of failing a
 * lookup or being filtered out.
 *
 * ## The two headline numbers
 *
 * `meta.total` is the business case; `meta.actionable` is the work — `total`
 * less the exceptions explained by predating Spares Automation. They are always
 * quoted together: either alone misleads, in opposite directions.
 */

import type {
  ExceptionSeverity,
  RepairException,
} from "@/features/initiative-8/types/repair"
import { exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import { oneOf, orUndefined } from "@/lib/api/format"
import type { ApiExceptionItem, ApiExceptionMeta, ApiSAPDocumentReference } from "@/lib/api/i8"
import { formatApiDate, getExceptions } from "@/lib/api/i8"
import type { SAPDocumentReference } from "@/lib/domain/contracts"

/** The API caps pageSize at 500. */
const PAGE_SIZE = 500

const SEVERITIES: readonly ExceptionSeverity[] = ["info", "warning", "critical"]

function document_(reference: ApiSAPDocumentReference): SAPDocumentReference {
  return {
    type: reference.type,
    documentNumber: reference.documentNumber,
    line: orUndefined(reference.line),
  }
}

/** One API row as the `RepairException` the queue renders. */
export function toRepairException(row: ApiExceptionItem): RepairException {
  const repairLine = document_(row.repairLine)
  return {
    id: row.id,
    type: row.type,
    // An unrecognised severity reads as a warning, not as "info": quietly
    // downgrading a finding the backend thought worth raising is the worse
    // mistake of the two.
    severity: oneOf(row.severity, SEVERITIES, "warning"),
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode,
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant ? { plantId: row.plant.plantId, name: row.plant.name } : undefined,
    repairLine,
    // Built only when both halves exist. A link to "4500001052-" is a 404 on a
    // line that may well exist, which is the hardest kind to diagnose.
    repairId: repairLine.line
      ? `${repairLine.documentNumber}-${repairLine.line}`
      : undefined,
    // Null for MISSING_ATTESTATION, absent from a backend that predates the
    // field; both mean "no second line to show".
    acquisitionLine: row.acquisitionLine ? document_(row.acquisitionLine) : undefined,
    title: row.title,
    detail: row.detail,
    raisedAt: row.raisedAt ? formatApiDate(row.raisedAt) : undefined,
    isOpenRepair: row.isOpenRepair,
    preAutomation: row.preAutomation,
  }
}

export type LiveExceptions = {
  items: RepairException[]
  meta: ApiExceptionMeta
  referenceDate: string
}

/**
 * Fetch the whole queue and adapt it. Filtered on the client, like the
 * register — a couple of thousand rows at most.
 *
 * Throws on failure: an empty queue and an unreachable backend are different
 * statements, and "no exceptions" is the most flattering possible way to
 * misreport a failed request on this screen.
 */
export async function loadLiveExceptions(): Promise<LiveExceptions> {
  const items: RepairException[] = []
  let page = 1
  let meta: ApiExceptionMeta | undefined
  let referenceDate = ""

  for (;;) {
    const body = await getExceptions({ page, pageSize: PAGE_SIZE })
    meta = body.meta
    referenceDate = body.referenceDate
    items.push(...body.items.map(toRepairException))
    if (items.length >= body.total || body.items.length === 0) break
    page += 1
  }

  return { items, meta: meta!, referenceDate }
}

// --- The queue's filters and export ----------------------------------------

export type ExceptionFilters = {
  /** An exception type, or "all". */
  type: string
  /** A plant id, or "all". */
  plant: string
  /** Only exceptions on repairs still out at a vendor. */
  openOnly: boolean
}

/**
 * The type filter's options, read off `meta.byType` — every type the backend
 * counted, known or not, most frequent first.
 */
export function exceptionTypeOptions(
  meta: Pick<ApiExceptionMeta, "byType">,
): { value: string; label: string; count: number }[] {
  return Object.entries(meta.byType)
    .map(([value, count]) => ({ value, label: exceptionTypeLabel(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Distinct plants on the rows, for the plant filter. */
export function exceptionPlantOptions(
  items: RepairException[],
): { plantId: string; name: string }[] {
  const plants = new Map<string, string>()
  for (const item of items) {
    if (item.plant) plants.set(item.plant.plantId, item.plant.name)
  }
  return [...plants]
    .map(([plantId, name]) => ({ plantId, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filterExceptions(
  items: RepairException[],
  filters: ExceptionFilters,
): RepairException[] {
  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false
    if (filters.plant !== "all" && item.plant?.plantId !== filters.plant) return false
    if (filters.openOnly && !item.isOpenRepair) return false
    return true
  })
}

function documentLabel(doc: SAPDocumentReference | undefined): string {
  if (!doc) return ""
  return doc.line ? `${doc.documentNumber}/${doc.line}` : doc.documentNumber
}

export const EXCEPTION_CSV_HEADERS = [
  "Exception",
  "Type",
  "Severity",
  "Title",
  "Detail",
  "Material",
  "Description",
  "Plant",
  "Repair line",
  "Acquisition line",
  "Raised",
  "Repair still open",
  "Raised before Spares Automation",
]

/** One CSV row per exception handed in — already filtered by the caller. */
export function exceptionRowsToCsv(items: RepairException[]): (string | number)[][] {
  return items.map((item) => [
    item.id,
    // The code, not the label: a spreadsheet filter wants a stable value, and
    // the code is what the API and the backend logs use.
    item.type,
    item.severity,
    item.title,
    item.detail,
    item.material.materialCode,
    item.material.description,
    item.plant ? `${item.plant.plantId} ${item.plant.name}` : "",
    documentLabel(item.repairLine),
    documentLabel(item.acquisitionLine),
    item.raisedAt ?? "",
    item.isOpenRepair ? "Yes" : "No",
    item.preAutomation ? "Yes" : "No",
  ])
}
