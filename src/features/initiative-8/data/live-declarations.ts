/**
 * The live declaration queue — `GET /api/i8/declarations` as the rows the
 * Declarations screen renders.
 *
 * Note what this is NOT: `data/declarations.ts` in this same folder is six
 * hand-written rows with invented people's names on them, and it is read by
 * the cross-initiative selectors that feed Home and the Action Center. Those
 * rows are the subject of audit finding 11.4 ("Live screens that still show
 * invented data"). This module is the real thing, and the screen reads this
 * one — a queue that shows made-up work is worse than no queue.
 *
 * Paged, unlike the coding-candidate screen: the backend caps a page at
 * `maxPageSize` and the queue is one row per repair line, so a single fetch
 * would silently truncate. The loop below follows `page`/`total` the same way
 * `live-register.ts` does.
 */

import type {
  DeclarationQueueRow,
  DeclarationQueueSummary,
} from "@/features/initiative-8/types/repair"
import type {
  ApiDeclarationItem,
  ApiDeclarationMeta,
  DeclarationQuery,
} from "@/lib/api/i8"
import { formatApiDate, getDeclarations } from "@/lib/api/i8"

/** `null` -> `undefined`, matching every other live-* adapter in this module. */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function toRow(row: ApiDeclarationItem): DeclarationQueueRow {
  return {
    id: row.id,
    material: {
      materialId: row.material.materialId,
      materialCode: row.material.materialCode ?? row.material.materialId,
      description: row.material.description ?? row.material.materialId,
    },
    plant: row.plant
      ? { plantId: row.plant.plantId, name: row.plant.name }
      : undefined,
    // A CODE, not a name: no person directory was delivered, so EKPO's
    // requisitioner is served as what it is. An invented name would read as
    // provenance this record does not have.
    requester: orUndefined(row.requester),
    purchaseRequisition: row.pr ? row.pr.documentNumber : undefined,
    relatedRepairId: row.relatedRepairId,
    hasActiveRepair: row.hasActiveRepair,
    status: row.status,
    declaredBy: orUndefined(row.declaredBy),
    declaredAt: row.declaredAt ? formatApiDate(row.declaredAt) : undefined,
    condition: orUndefined(row.condition),
    nextAction: row.nextAction,
    createdAt: row.createdAt ? formatApiDate(row.createdAt) : undefined,
  }
}

function toSummary(meta: ApiDeclarationMeta): DeclarationQueueSummary {
  return {
    total: meta.total,
    outstanding: meta.outstanding,
    byStatus: meta.byStatus,
    attestationWindowDays: meta.attestationWindowDays,
  }
}

export type LiveDeclarations = {
  rows: DeclarationQueueRow[]
  summary: DeclarationQueueSummary
  referenceDate?: string
  /**
   * True when the page loop stopped before reading everything.
   *
   * Reported rather than hidden, for the same reason the coding screen
   * reports `wasTruncated`: a queue that quietly shows the first 2,000 of
   * 9,000 rows reads as a complete queue, and somebody will work it to the
   * bottom and believe they are done.
   */
  truncated: boolean
}

/** How many rows the screen will load before it stops and says so. */
const MAX_ROWS = 2000
const PAGE_SIZE = 500

/**
 * Fetch the whole declaration queue, following pages.
 *
 * Throws on failure — the caller renders that visibly, same contract as
 * `loadLiveRegister`. A failed request is not an empty queue, and the one must
 * never render as the other.
 */
export async function loadLiveDeclarations(
  query: Omit<DeclarationQuery, "page" | "pageSize"> = {},
): Promise<LiveDeclarations> {
  const rows: DeclarationQueueRow[] = []
  let summary: DeclarationQueueSummary | null = null
  let referenceDate: string | undefined
  let page = 1
  let total = 0

  for (;;) {
    const body = await getDeclarations({ ...query, page, pageSize: PAGE_SIZE })
    summary ??= toSummary(body.meta)
    referenceDate ??= body.referenceDate ? formatApiDate(body.referenceDate) : undefined
    total = body.total

    rows.push(...body.items.map(toRow))

    if (rows.length >= total || body.items.length === 0 || rows.length >= MAX_ROWS) break
    page += 1
  }

  return {
    rows,
    summary: summary ?? {
      total: 0,
      outstanding: 0,
      byStatus: {},
      attestationWindowDays: 0,
    },
    referenceDate,
    truncated: rows.length < total,
  }
}
