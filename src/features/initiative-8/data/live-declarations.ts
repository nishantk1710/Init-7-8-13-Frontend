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
import type { ApiAttestation } from "@/lib/api/i8"
import { formatApiDate, getAttestations, getDeclarations } from "@/lib/api/i8"

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
    repairPO: row.repairPo
      ? {
          type: "PO",
          documentNumber: row.repairPo.documentNumber,
          line: row.repairPo.line ?? undefined,
        }
      : undefined,
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

/**
 * One recorded attestation, for the declaration LOG.
 *
 * The queue above answers "who still owes one". This answers "what was
 * actually judged, by whom, on what" -- the FR-4 fields the queue has no room
 * for: quantity, fault category, the condition description somebody typed,
 * and the optional serial. `GET /api/i8/attestations` has been live
 * throughout with nothing calling it.
 */
export type DeclarationLogRow = {
  id: string
  material: { materialId: string; materialCode: string; description: string }
  plant?: { plantId: string; name: string }
  quantity: string
  condition: string
  faultCategory: string
  conditionDescription: string
  serialNumber?: string
  /** Always empty today: there is no sign-in, so the server stamps a
   *  placeholder. Shown as recorded rather than prettied up. */
  attestor: string
  attestedAt?: string
  /** Set when a later amendment replaced this one. The original is never
   *  edited or removed, so a reader needs this to know it is not current. */
  supersededBy?: string
  /** True when this row IS an amendment of an earlier one. */
  isAmendment: boolean
}

function toLogRow(row: ApiAttestation): DeclarationLogRow {
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
    quantity: row.quantity,
    condition: row.condition,
    faultCategory: row.faultCategory,
    conditionDescription: row.conditionDescription,
    serialNumber: row.serialNumber ?? undefined,
    attestor: row.attestor,
    attestedAt: row.attestedAt ? formatApiDate(row.attestedAt) : undefined,
    supersededBy: row.supersededBy ?? undefined,
    isAmendment: Boolean(row.supersedes),
  }
}

export type LiveDeclarations = {
  rows: DeclarationQueueRow[]
  summary: DeclarationQueueSummary
  /**
   * Recorded attestations, newest first. Null when that call failed -- the
   * queue is still worth showing without the log, but an empty log must not
   * be served in place of a failed one.
   */
  log: DeclarationLogRow[] | null
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

  // Superseded rows are kept: they are the audit history, and an amendment
  // chain with the amended row hidden is not a chain.
  const log = await getAttestations()
    .then((body) => body.items.map(toLogRow))
    .catch(() => null)

  return {
    rows,
    log,
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
