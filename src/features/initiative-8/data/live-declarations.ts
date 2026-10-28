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
 * ## Paged on the server
 *
 * The screen asks for ONE page, and the backend searches, filters and counts.
 * It used to follow the pages to the end -- every repair line is undeclared,
 * so that was the whole 5,153-line register -- and filter in the browser,
 * which made a 17 MB page. The filters and the page live in the URL, as on
 * the Justifications screen (`live-justifications.ts`).
 */

import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import type {
  DeclarationQueueRow,
  DeclarationQueueSummary,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import type {
  ApiDeclarationItem,
  ApiDeclarationMeta,
  ApiDeclarationPage,
  DeclarationQuery,
} from "@/lib/api/i8"
import type { ApiAttestation } from "@/lib/api/i8"
import { getAttestations, getDeclarations } from "@/lib/api/i8"
import { i08Date, i08DateTime } from "@/features/initiative-8/utils/format"
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination"

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
    // Name when LFA1 gave one, else the code. A code is a fact; an invented
    // name is not, and "Unknown vendor" is reserved for a line with neither.
    vendor: row.vendorName ?? row.vendor ?? undefined,
    repairStatus: (row.repairStatus as RepairStatus | null) ?? undefined,
    status: row.status,
    declaredBy: orUndefined(row.declaredBy),
    declaredAt: row.declaredAt ? i08Date(row.declaredAt) : undefined,
    condition: orUndefined(row.condition),
    nextAction: row.nextAction,
    createdAt: row.createdAt ? i08Date(row.createdAt) : undefined,
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
  /** The repair line it was declared against, as the register keys it --
   *  absent for a part declared with no repair line. */
  repairId?: string
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
    // A full timestamp, so the date AND the time: the shared formatApiDate
    // turned a timestamp into an invalid date, and this column read "—" on
    // every row (I08_Live_UI_Redesign_Plan.md, Q11).
    attestedAt: row.attestedAt ? i08DateTime(row.attestedAt) : undefined,
    supersededBy: row.supersededBy ?? undefined,
    isAmendment: Boolean(row.supersedes),
    repairId:
      row.repairDocument && row.repairItem ? `${row.repairDocument}-${row.repairItem}` : undefined,
  }
}

/**
 * Every recorded attestation, newest first, for the declaration log. Null when
 * the call failed: the queue is still worth showing without the log, but an
 * empty log must not be served in place of a failed one.
 *
 * Not paged. It holds what people have declared -- six rows today -- and grows
 * only as fast as they declare. Superseded rows are kept: they are the audit
 * history, and an amendment chain with the amended row hidden is not a chain.
 */
export async function loadDeclarationLog(): Promise<DeclarationLogRow[] | null> {
  return getAttestations()
    .then((body) => body.items.map(toLogRow))
    .catch(() => null)
}

// --- One page of the queue --------------------------------------------------

export const DECLARATIONS_PATH = "/repairable-spares/declarations"

/** The backend's max_page_size: as few export round trips as the API allows. */
const EXPORT_PAGE_SIZE = 500

/** A ceiling on export requests, so a backend that ignored `page` and kept
 *  returning full pages could never loop forever. 200 x 500 rows. */
const MAX_EXPORT_PAGES = 200

/** What the queue can be narrowed by. Each is a URL parameter of the same name. */
export type DeclarationFilters = {
  q?: string
  plant?: string
  /** A vendor CODE, as the facets list it. */
  vendor?: string
  /** Where the repair stands -- PO Issued, At Vendor, Closed. */
  repairStatus?: string
}

export type DeclarationFacets = {
  plants: { plantId: string; name: string }[]
  /** `value` is the code the filter takes; `label` is the name, else the code. */
  vendors: { value: string; label: string }[]
  repairStatuses: string[]
}

export type DeclarationsPage = {
  rows: DeclarationQueueRow[]
  /** Matching the filters. */
  total: number
  /** The whole queue's counts, whatever the filters. */
  summary: DeclarationQueueSummary
  facets: DeclarationFacets
}

type FetchDeclarations = typeof getDeclarations

export function parseDeclarationParams(raw: RawSearchParams): {
  filters: DeclarationFilters
  page: number
} {
  return {
    filters: {
      q: single(raw.q),
      plant: single(raw.plant),
      vendor: single(raw.vendor),
      repairStatus: single(raw.repairStatus),
    },
    page: parsePage(raw.page) ?? 1,
  }
}

export function isDeclarationFiltered(filters: DeclarationFilters): boolean {
  return Boolean(filters.q || filters.plant || filters.vendor || filters.repairStatus)
}

/**
 * The link to one page of the queue, keeping the filters. Page 1 drops `page`,
 * so the plain screen and its first page are one URL.
 */
export function declarationsHref(filters: DeclarationFilters, page = 1): string {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.plant) params.set("plant", filters.plant)
  if (filters.vendor) params.set("vendor", filters.vendor)
  if (filters.repairStatus) params.set("repairStatus", filters.repairStatus)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `${DECLARATIONS_PATH}?${query}` : DECLARATIONS_PATH
}

/**
 * Outstanding rows only, and not as a default somebody can switch off: the
 * table has no declaration-status column, so a Completed row would look
 * exactly like an undeclared one (see `DeclarationsTable`).
 */
function declarationQuery(filters: DeclarationFilters): DeclarationQuery {
  return {
    outstandingOnly: true,
    q: filters.q,
    plant: filters.plant,
    vendor: filters.vendor,
    repairStatus: filters.repairStatus,
  }
}

/**
 * The dropdown values. The backend takes them before the filters, so choosing
 * one plant does not take the other out of the list. A backend older than
 * paging sends none; the page's rows are then the best there is.
 */
function facetsOf(body: ApiDeclarationPage): DeclarationFacets {
  if (body.facets) {
    return {
      plants: body.facets.plants.map((p) => ({ plantId: p.plantId, name: p.name })),
      vendors: body.facets.vendors.map((v) => ({ value: v.vendor, label: v.name ?? v.vendor })),
      repairStatuses: body.facets.repairStatuses,
    }
  }
  const plants = new Map<string, string>()
  const vendors = new Map<string, string>()
  const statuses = new Set<string>()
  for (const item of body.items) {
    if (item.plant) plants.set(item.plant.plantId, item.plant.name)
    if (item.vendor) {
      vendors.set(item.vendor, item.vendorName ?? vendors.get(item.vendor) ?? item.vendor)
    }
    if (item.repairStatus) statuses.add(item.repairStatus)
  }
  return {
    plants: [...plants]
      .map(([plantId, name]) => ({ plantId, name }))
      .sort((a, b) => a.plantId.localeCompare(b.plantId)),
    vendors: [...vendors]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    repairStatuses: [...statuses].sort(),
  }
}

/**
 * One page of the queue, with the counts and dropdown values around it.
 *
 * Unfiltered, that is one request. With a filter, a second one-row request
 * without it reads the counts, because they describe the whole queue: "how
 * much of the register is undeclared" must not change because somebody looked
 * at one plant. The dropdown values come from the page's own request either
 * way -- the backend takes them before the filters.
 *
 * Throws on failure, so a failed request is never shown as an empty queue.
 */
export async function loadDeclarationsPage(
  filters: DeclarationFilters,
  page: number,
  {
    pageSize = DEFAULT_PAGE_SIZE,
    fetchPage = getDeclarations,
  }: { pageSize?: number; fetchPage?: FetchDeclarations } = {},
): Promise<DeclarationsPage> {
  const request = { ...declarationQuery(filters), page, pageSize }
  const [matching, whole] = isDeclarationFiltered(filters)
    ? await Promise.all([
        fetchPage(request),
        fetchPage({ ...declarationQuery({}), pageSize: 1 }),
      ])
    : await fetchPage(request).then((body) => [body, body] as const)

  return {
    rows: matching.items.map(toRow),
    total: matching.total,
    summary: toSummary(whole.meta),
    facets: facetsOf(matching),
  }
}

/**
 * Every row the filters match, for the export: the queue, not the page.
 *
 * Deduplicated by id, in case a page boundary moves while the export runs. A
 * declaration recorded mid-export takes its row out of the queue and pulls the
 * rest up one, so the row after it is missed: an export of a moving queue is
 * as of when each page was read.
 */
export async function fetchAllDeclarations(
  filters: DeclarationFilters,
  fetchPage: FetchDeclarations = getDeclarations,
): Promise<DeclarationQueueRow[]> {
  const byId = new Map<string, DeclarationQueueRow>()
  for (let page = 1; page <= MAX_EXPORT_PAGES; page++) {
    const body = await fetchPage({ ...declarationQuery(filters), page, pageSize: EXPORT_PAGE_SIZE })
    for (const row of body.items.map(toRow)) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }
    if (body.items.length < EXPORT_PAGE_SIZE || page * EXPORT_PAGE_SIZE >= body.total) break
  }
  return [...byId.values()]
}
