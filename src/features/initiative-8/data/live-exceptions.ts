/**
 * The live exception queue — `GET /api/i8/exceptions` as the rows the
 * Exceptions screen renders.
 *
 * ## Expect this to be large, and say so
 *
 * Every historical repair line raises `MISSING_ATTESTATION`, because the
 * control did not exist before this platform. That number is the business case
 * for the declaration work, not a bug in it — which is exactly why the summary
 * carries `actionable` (total less pre-automation) alongside `total`. Quoting
 * either one on its own misleads, in opposite directions.
 *
 * ## Paged, and honest when it stops
 *
 * The backend caps a page, and the queue can run to thousands of rows. The
 * loop below stops at `MAX_ROWS` and reports that it did. A queue that
 * silently shows the first slice reads as a complete queue, and somebody will
 * work it to the bottom and believe they are finished.
 */

import type {
  ExceptionQueueRow,
  ExceptionQueueSummary,
} from "@/features/initiative-8/types/repair"
import type {
  ApiExceptionItem,
  ApiExceptionMeta,
  ExceptionQuery,
} from "@/lib/api/i8"
import { formatApiDate, getExceptions } from "@/lib/api/i8"

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function toRow(row: ApiExceptionItem): ExceptionQueueRow {
  return {
    id: row.id,
    // A plain string, never switched over exhaustively: the backend declares
    // more types than it raises, and one this build has not heard of must
    // still render.
    type: row.type,
    severity: row.severity,
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode ?? row.material.materialId,
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : undefined,
    repairLine: row.repairLine.line
      ? `${row.repairLine.documentNumber}-${row.repairLine.line}`
      : row.repairLine.documentNumber,
    // The register's detail route is keyed {document}-{item}, so a line
    // without an item cannot be linked -- and is served unlinked rather than
    // linked to a page that will 404.
    repairId: row.repairLine.line
      ? `${row.repairLine.documentNumber}-${row.repairLine.line}`
      : undefined,
    acquisitionLine: row.acquisitionLine
      ? row.acquisitionLine.line
        ? `${row.acquisitionLine.documentNumber}-${row.acquisitionLine.line}`
        : row.acquisitionLine.documentNumber
      : undefined,
    title: row.title,
    detail: row.detail,
    raisedAt: row.raisedAt ? formatApiDate(row.raisedAt) : undefined,
    isOpenRepair: row.isOpenRepair,
    preAutomation: row.preAutomation,
  }
}

function toSummary(meta: ApiExceptionMeta): ExceptionQueueSummary {
  return {
    total: meta.total,
    actionable: meta.actionable,
    preAutomation: meta.preAutomation,
    byType: meta.byType,
    bySeverity: meta.bySeverity,
    linesChecked: meta.linesChecked,
    linesCovered: meta.linesCovered,
    typesRaised: meta.typesRaised,
    attestationWindowDays: meta.attestationWindowDays,
    attestationCutoverDate: orUndefined(meta.attestationCutoverDate),
    justificationWindowDays: meta.justificationWindowDays,
    acquisitionsChecked: meta.acquisitionsChecked,
  }
}

export type LiveExceptions = {
  rows: ExceptionQueueRow[]
  summary: ExceptionQueueSummary
  referenceDate?: string
  truncated: boolean
}

const MAX_ROWS = 2000
const PAGE_SIZE = 500

/**
 * Fetch the exception queue, following pages.
 *
 * Throws on failure — a failed request is not an empty queue, and on this
 * screen above all the two must never render the same: "no exceptions" is the
 * single most expensive wrong answer here.
 */
export async function loadLiveExceptions(
  query: Omit<ExceptionQuery, "page" | "pageSize"> = {},
): Promise<LiveExceptions> {
  const rows: ExceptionQueueRow[] = []
  let summary: ExceptionQueueSummary | null = null
  let referenceDate: string | undefined
  let page = 1
  let total = 0

  for (;;) {
    const body = await getExceptions({ ...query, page, pageSize: PAGE_SIZE })
    summary ??= toSummary(body.meta)
    referenceDate ??= body.referenceDate
      ? formatApiDate(body.referenceDate)
      : undefined
    total = body.total

    rows.push(...body.items.map(toRow))

    if (rows.length >= total || body.items.length === 0 || rows.length >= MAX_ROWS)
      break
    page += 1
  }

  return {
    rows,
    summary: summary ?? {
      total: 0,
      actionable: 0,
      preAutomation: 0,
      byType: {},
      bySeverity: {},
      linesChecked: 0,
      linesCovered: 0,
      typesRaised: [],
      attestationWindowDays: 0,
    },
    referenceDate,
    truncated: rows.length < total,
  }
}
