/**
 * The live exception queue — `GET /api/i8/exceptions` as the rows the
 * Exceptions screen renders.
 *
 * ## Two ways in
 *
 * The Exceptions screen asks for ONE page (`loadExceptionsPage`), and the
 * server searches, filters and counts. It used to load the whole queue and
 * filter it in the browser, which made it a 17 MB page that took ten seconds
 * to arrive.
 *
 * `loadLiveExceptions` still follows every page, for the repair detail page's
 * own short list -- which asks for one line with `repair`, so in practice it
 * is one request. The register's Exceptions column used to be filled by
 * loading the whole queue here and joining it in the browser; the register
 * listing serves each line's items itself now.
 *
 * ## Expect this to be large, and say so
 *
 * Every historical repair line raises `MISSING_ATTESTATION`, because the
 * control did not exist before this platform. That number is the business case
 * for the declaration work, not a bug in it — which is exactly why the summary
 * carries `actionable` (total less pre-automation) alongside `total`. Quoting
 * either one on its own misleads, in opposite directions.
 *
 * `preAutomation` depends on `attestationCutoverDate`, which is unset on the
 * deployed backend -- so every row currently reads as actionable, and
 * `actionable === total`. Hiding pre-automation rows, on this screen, hides
 * nothing today. It stays applied because it is correct and will matter the
 * day VZI supplies the date (FRS open item, audit §10 item 5's sibling), but
 * it must not be read as a way to make this fetch shorter right now.
 *
 * ## Paged, to the end
 *
 * The backend caps a page at `maxPageSize` (500), and the queue can run to
 * thousands of rows. The loop below follows pages until it has everything,
 * the same way `live-register.ts` and `live-declarations.ts` do. There used
 * to be a `MAX_ROWS` ceiling here, and it is why this screen showed "first
 * 2,000 of 5,975" -- a limit this file imposed on itself, not one the API or
 * the browser required. Removed 13-Oct-2026 for the same reason it came out
 * of the declaration queue: a cap with a caption still shows a partial queue,
 * and the caption does not make that true.
 *
 * ## Every check the backend raises
 *
 * From 14-Oct to 27-Oct-2026 this loader dropped `UNJUSTIFIED_ACQUISITION`
 * ("bought new while a repair was open, with no reason recorded"), rows and
 * counts, and asked the backend to leave it out. It never fired: it dated a
 * new purchase from a PO-line creation date the live data does not carry, so
 * 0 of 6,837 purchases were ever checked. Since 27-Oct the backend checks the
 * new-buy purchase request instead -- that is where a new unit is asked for --
 * so the finding is real work again and the queue carries it like any other.
 * A purchase or a repair can now be a PR as well as a PO; the row says which.
 */

import type {
  ExceptionEvent,
  ExceptionQueueRow,
  ExceptionQueueSummary,
  ExceptionStatus,
} from "@/features/initiative-8/types/repair"
import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import { toExceptionStatus } from "@/features/initiative-8/utils/status"
import type {
  ApiExceptionEvent,
  ApiExceptionItem,
  ApiExceptionMeta,
  ApiExceptionPage,
  ApiSAPDocumentReference,
  ExceptionQuery,
} from "@/lib/api/i8"
import { i08Date, i08DateTime } from "@/features/initiative-8/utils/format"
import { formatApiDate, getExceptions } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination"

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

/**
 * A repair as the register keys it. A repair PO line is `{EBELN}-{EBELP}`; a
 * repair requested on a PR with no PO yet is `PR-{BANFN}-{BNFPO}`, the id of
 * its register row, so the link from the queue lands on that row's page and
 * the repair detail page's own list finds it. Undefined without an item: the
 * detail route is keyed {document}-{item}, and a link to a page that will 404
 * is worse than none.
 */
function repairKeyOf(line: ApiSAPDocumentReference): string | undefined {
  if (!line.line) return undefined
  const document = line.type === "PR" ? `PR-${line.documentNumber}` : line.documentNumber
  return `${document}-${line.line}`
}

/**
 * One wire item as the row the screens render. Exported for the exception
 * drawer, which shows the item a write sends back.
 */
export function toExceptionRow(row: ApiExceptionItem): ExceptionQueueRow {
  const repairId = repairKeyOf(row.repairLine)
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
    repairLine: repairId ?? row.repairLine.documentNumber,
    // A line without an item cannot be linked -- see `repairKeyOf`.
    repairId,
    // The wire's own type, so the screens can tell a PR from a PO. An older
    // backend always said PO; it still does for a repair PO line.
    repairLineType: row.repairLine.type,
    acquisitionLine: row.acquisitionLine
      ? row.acquisitionLine.line
        ? `${row.acquisitionLine.documentNumber}-${row.acquisitionLine.line}`
        : row.acquisitionLine.documentNumber
      : undefined,
    acquisitionType: row.acquisitionLine?.type,
    reservationLine: row.reservationLine
      ? row.reservationLine.line
        ? `${row.reservationLine.documentNumber}-${row.reservationLine.line}`
        : row.reservationLine.documentNumber
      : undefined,
    declarationId: row.declarationId ?? undefined,
    title: row.title,
    detail: row.detail,
    raisedAt: row.raisedAt ? i08Date(row.raisedAt) : undefined,
    preAutomation: row.preAutomation,
    // Defaults for a backend that does not serve the lifecycle yet. OPEN and
    // unassigned is what an untouched item genuinely is, so an older API and
    // a brand-new finding read the same way -- which is correct, because they
    // are the same thing. A backend older than 21-Oct-2026 can still say
    // IN_PROGRESS or RESOLVED; those read as OPEN and CLOSED.
    status: toExceptionStatus(row.status) ?? "OPEN",
    owner: row.owner ?? undefined,
    stillDetected: row.stillDetected ?? true,
    history: (row.history ?? []).map(toEvent),
  }
}

function toEvent(event: ApiExceptionEvent): ExceptionEvent {
  return {
    id: event.id,
    kind: event.kind,
    status: toExceptionStatus(event.status),
    owner: event.owner ?? undefined,
    actor: event.actor,
    text: event.text,
    at: i08DateTime(event.at),
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

    rows.push(...body.items.map(toExceptionRow))

    // Stops on the total, or on an empty page -- never on a row count of its
    // own, which is what let the fetch stop short of everything before.
    if (rows.length >= total || body.items.length === 0) break
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
    // Measured on what was fetched against what the backend said it had.
    truncated: rows.length < total,
  }
}

// --- One page, for the Exceptions screen ------------------------------------

export const EXCEPTIONS_PATH = "/repairable-spares/exceptions"

/**
 * The status the screen opens on, and what an absent `?status=` means.
 *
 * Not "every status": the queue runs to thousands of rows and almost all of it
 * is historical, so starting on everything would bury the handful somebody can
 * act on. `?status=all` asks for every status. There is no blended "Open + In
 * progress" choice: it was a fifth, synthetic option and was removed on
 * request.
 */
export const DEFAULT_EXCEPTION_STATUS: ExceptionStatus = "OPEN"

/** `?status=` for every status. */
export const ALL_STATUSES = "all"

/** A ceiling on export requests, so a backend that ignored `page` and kept
 *  returning full pages could never loop forever. 200 x 500 rows. */
const MAX_EXPORT_PAGES = 200

/**
 * What the queue can be narrowed by. Each is a URL parameter of the same name.
 *
 * No "open repairs only" since 19-Oct-2026: every repair line an item names is
 * open in SAP, so the filter could only ever return the whole queue.
 */
export type ExceptionFilters = {
  q?: string
  type?: string
  plant?: string
  /** One status, or undefined for every status (`?status=all`). */
  status?: string
  /** One repair line, as the register keys it: the link its Exceptions
   *  column and the repair detail page follow. */
  repair?: string
}

export type ExceptionFacets = {
  plants: { plantId: string; name: string }[]
  types: string[]
}

export type ExceptionsPage = {
  rows: ExceptionQueueRow[]
  /** Matching the filters. */
  total: number
  /** The whole queue's counts, whatever the filters. */
  summary: ExceptionQueueSummary
  facets: ExceptionFacets
  /** Items per type under every filter but the type: the type tabs' counts.
   *  Undefined from a backend that does not send them; the tabs then show
   *  no numbers rather than the whole check's, which ignore the status. */
  typeCounts?: Record<string, number>
}

type FetchExceptions = typeof getExceptions

export function parseExceptionParams(raw: RawSearchParams): {
  filters: ExceptionFilters
  page: number
  /** `?id=`: open this item's drawer. */
  id?: string
} {
  const status = single(raw.status)
  return {
    filters: {
      q: single(raw.q),
      type: single(raw.type),
      plant: single(raw.plant),
      // An old bookmark's ?status=RESOLVED or IN_PROGRESS is read as the
      // status it became, so the dropdown names it and the link still works.
      status:
        status === undefined
          ? DEFAULT_EXCEPTION_STATUS
          : status.toLowerCase() === ALL_STATUSES
            ? undefined
            : (toExceptionStatus(status) ?? status.toUpperCase()),
      repair: single(raw.repair),
    },
    page: parsePage(raw.page) ?? 1,
    id: single(raw.id),
  }
}

/** How many filters narrow the queue. The default status is not one: counting
 *  it would show "1 filter" on an untouched screen. */
export function activeExceptionFilters(filters: ExceptionFilters): number {
  return [
    filters.q,
    filters.type,
    filters.plant,
    filters.repair,
    filters.status !== DEFAULT_EXCEPTION_STATUS,
  ].filter(Boolean).length
}

/**
 * The link to one page of the queue, keeping the filters. Page 1 drops `page`
 * and the default status drops `status`, so the plain screen is one URL.
 */
export function exceptionsHref(filters: ExceptionFilters, page = 1): string {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.type) params.set("type", filters.type)
  if (filters.plant) params.set("plant", filters.plant)
  if (filters.status === undefined) params.set("status", ALL_STATUSES)
  else if (filters.status !== DEFAULT_EXCEPTION_STATUS) params.set("status", filters.status)
  if (filters.repair) params.set("repair", filters.repair)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `${EXCEPTIONS_PATH}?${query}` : EXCEPTIONS_PATH
}

/**
 * The request for what the screen shows.
 *
 * `actionableOnly` is always on, because it says what this queue is rather
 * than narrows it: lines raised before the control existed are a reason
 * rather than work. It filters nothing until VZI supplies the cutover date.
 * No `excludeType` since 27-Oct-2026: the queue carries every check the
 * backend raises (see the header).
 */
function exceptionQuery(filters: ExceptionFilters): ExceptionQuery {
  return {
    q: filters.q,
    type: filters.type,
    plant: filters.plant,
    status: filters.status,
    repair: filters.repair,
    actionableOnly: true,
  }
}

/** Not a pre-automation line. The backend leaves those out already; this
 *  guards one older than paging, which ignores `actionableOnly`. On the
 *  current one it removes nothing. */
function shown(row: ExceptionQueueRow): boolean {
  return !row.preAutomation
}

/**
 * The dropdown values. The types that run are offered as well as those that
 * found something, so a running check that found nothing is still a choice.
 * A backend older than paging sends no facets; the page's rows are then the
 * best there is.
 */
function facetsOf(
  body: ApiExceptionPage,
  rows: ExceptionQueueRow[],
  typesRaised: string[],
): ExceptionFacets {
  const plants = body.facets
    ? body.facets.plants.map((p) => ({ plantId: p.plantId, name: p.name }))
    : [
        ...new Map(
          rows.flatMap((row) => (row.plant ? [[row.plant.plantId, row.plant] as const] : [])),
        ).values(),
      ].sort((a, b) => a.plantId.localeCompare(b.plantId))
  const types = new Set([...typesRaised, ...(body.facets?.types ?? rows.map((r) => r.type))])
  return { plants, types: [...types].sort() }
}

/**
 * One page of the queue, with the counts and dropdown values around it -- in
 * one request, because the summary describes the whole check whatever the
 * filters and the facets are taken before them.
 *
 * Throws on failure, the same contract as `loadLiveExceptions`.
 */
export async function loadExceptionsPage(
  filters: ExceptionFilters,
  page: number,
  {
    pageSize = DEFAULT_PAGE_SIZE,
    fetchPage = getExceptions,
  }: { pageSize?: number; fetchPage?: FetchExceptions } = {},
): Promise<ExceptionsPage> {
  const body = await fetchPage({ ...exceptionQuery(filters), page, pageSize })
  const rows = body.items.map(toExceptionRow).filter(shown)
  const summary = toSummary(body.meta)
  return {
    rows,
    total: body.total,
    summary,
    facets: facetsOf(body, rows, summary.typesRaised),
    typeCounts: body.typeCounts ?? undefined,
  }
}

/**
 * Every item the filters match, for the export: the queue, not the page.
 *
 * Fetched in the largest pages the backend serves. Deduplicated by id, because
 * the queue is recomputed on every read and an item raised mid-export pushes
 * the rest down a row. One resolved mid-export pulls them up instead, and that
 * row is missed: an export of a moving queue is as of when each page was read.
 */
export async function fetchAllExceptions(
  filters: ExceptionFilters,
  fetchPage: FetchExceptions = getExceptions,
): Promise<ExceptionQueueRow[]> {
  const byId = new Map<string, ExceptionQueueRow>()
  for (let page = 1; page <= MAX_EXPORT_PAGES; page++) {
    const body = await fetchPage({ ...exceptionQuery(filters), page, pageSize: PAGE_SIZE })
    for (const row of body.items.map(toExceptionRow)) {
      if (shown(row) && !byId.has(row.id)) byId.set(row.id, row)
    }
    if (body.items.length < PAGE_SIZE || page * PAGE_SIZE >= body.total) break
  }
  return [...byId.values()]
}
