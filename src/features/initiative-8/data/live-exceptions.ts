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
 * `loadLiveExceptions` still loads all of it, for the two readers that join it
 * to repair lines: the register's Exceptions column, and the repair detail
 * page's own short list (which asks for one line with `repair`).
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
 */

import type {
  ExceptionEvent,
  ExceptionQueueRow,
  ExceptionQueueSummary,
  ExceptionStatus,
  RepairChain,
  RepairLineException,
} from "@/features/initiative-8/types/repair"
import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import type {
  ApiExceptionEvent,
  ApiExceptionItem,
  ApiExceptionMeta,
  ApiExceptionPage,
  ExceptionQuery,
} from "@/lib/api/i8"
import { formatApiDateTime } from "@/lib/api/format"
import { formatApiDate, getExceptions } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination"

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

/**
 * One wire item as the row the screens render. Exported for the exception
 * drawer, which shows the item a write sends back.
 */
export function toExceptionRow(row: ApiExceptionItem): ExceptionQueueRow {
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
    // Defaults for a backend that does not serve the lifecycle yet. OPEN and
    // unassigned is what an untouched item genuinely is, so an older API and
    // a brand-new finding read the same way -- which is correct, because they
    // are the same thing.
    status: row.status ?? "OPEN",
    owner: row.owner ?? undefined,
    stillDetected: row.stillDetected ?? true,
    history: (row.history ?? []).map(toEvent),
  }
}

function toEvent(event: ApiExceptionEvent): ExceptionEvent {
  return {
    id: event.id,
    kind: event.kind,
    status: (event.status as ExceptionStatus | null) ?? undefined,
    owner: event.owner ?? undefined,
    actor: event.actor,
    text: event.text,
    at: formatApiDateTime(event.at),
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
 * Checks the queue no longer carries.
 *
 * `UNJUSTIFIED_ACQUISITION` — "bought new while a repair was open, with no
 * justification" — came out on 14-Oct-2026. FR-5b asks the requester for that
 * reason at the moment of the reservation, and the Spares Assistant is where
 * it is asked, so a purchase that reaches this queue unjustified is the case
 * the control upstream exists to prevent. Raising it again afterwards gives
 * nobody work they do not already have.
 *
 * The backend still runs the check and still serves its count. The
 * Justifications screen is where that number belongs — beside the reasons
 * themselves and the share of purchases that carry one — rather than in a
 * queue somebody is meant to work through.
 *
 * Dropped here rather than in the table so that everything reading this
 * loader agrees about what the queue holds: the summary band, the type
 * filter, the CSV export, and the register's per-line exception chips.
 */
const DROPPED_TYPES: ReadonlySet<string> = new Set(["UNJUSTIFIED_ACQUISITION"])

/**
 * The summary, describing the rows that are left.
 *
 * Subtracted from the backend's own counts rather than recomputed from the
 * rows: `linesChecked`, `linesCovered` and the window settings are facts about
 * the run that no amount of row counting reproduces, and `total` has to keep
 * meaning what the band above the table says it means.
 *
 * `acquisitionsChecked` and `justificationWindowDays` are left alone. They
 * describe the justification check, which still runs — the Justifications
 * screen reads them from the same meta and reports them there.
 */
function withoutDroppedTypes(
  summary: ExceptionQueueSummary,
  dropped: ExceptionQueueRow[],
): ExceptionQueueSummary {
  const preAutomation = dropped.filter((row) => row.preAutomation).length
  const bySeverity = { ...summary.bySeverity }
  for (const row of dropped) {
    if (bySeverity[row.severity] !== undefined) {
      bySeverity[row.severity] = Math.max(0, bySeverity[row.severity] - 1)
    }
  }

  return {
    ...summary,
    total: Math.max(0, summary.total - dropped.length),
    actionable: Math.max(0, summary.actionable - (dropped.length - preAutomation)),
    preAutomation: Math.max(0, summary.preAutomation - preAutomation),
    byType: Object.fromEntries(
      Object.entries(summary.byType).filter(([type]) => !DROPPED_TYPES.has(type)),
    ),
    bySeverity,
    // Out of `typesRaised` too, and this is the half that shows today: the
    // deployed backend raises none of these but still declares the check, so
    // the type sat in the filter dropdown and in "How each check works" with
    // nothing behind it either way.
    typesRaised: summary.typesRaised.filter((type) => !DROPPED_TYPES.has(type)),
  }
}

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

  // Truncation is measured on what was FETCHED against what the backend said
  // it had, before anything is dropped -- the dropped rows arrived, they are
  // just not shown, and counting them as missing would raise the partial-queue
  // banner on a complete queue.
  const truncated = rows.length < total
  const kept = rows.filter((row) => !DROPPED_TYPES.has(row.type))
  const dropped = rows.filter((row) => DROPPED_TYPES.has(row.type))

  return {
    rows: kept,
    summary: withoutDroppedTypes(
      summary ?? {
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
      dropped,
    ),
    referenceDate,
    truncated,
  }
}

/**
 * Hang each line's exception items off the register rows.
 *
 * The register and the exception queue are two different endpoints: the
 * register knows nothing about the checks, and the checks are recomputed from
 * it on every read. The join is by `repairId`, which the queue serves exactly
 * so this is possible.
 *
 * `rows === null` means the exception fetch failed, and every chain comes back
 * with `exceptions` left undefined — the register then shows "Not checked"
 * rather than an empty cell. An empty array means the checks ran and found
 * nothing against that line, which is a different and much stronger claim.
 */
export function attachLineExceptions(
  chains: RepairChain[],
  rows: ExceptionQueueRow[] | null,
): RepairChain[] {
  if (rows === null) return chains

  const byLine = new Map<string, RepairLineException[]>()
  for (const row of rows) {
    // An item the queue could not tie back to a register line (no repairId)
    // is still a real finding; it just has no row here to sit on.
    if (!row.repairId) continue
    const found = byLine.get(row.repairId)
    const item = { id: row.id, type: row.type, severity: row.severity }
    if (found) found.push(item)
    else byLine.set(row.repairId, [item])
  }

  return chains.map((chain) => ({
    ...chain,
    exceptions: byLine.get(chain.id) ?? [],
  }))
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

/** What the queue can be narrowed by. Each is a URL parameter of the same name. */
export type ExceptionFilters = {
  q?: string
  type?: string
  plant?: string
  /** `?open=1`: only repairs still out at a vendor. */
  open?: boolean
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
      open: single(raw.open) === "1",
      status:
        status === undefined
          ? DEFAULT_EXCEPTION_STATUS
          : status.toLowerCase() === ALL_STATUSES
            ? undefined
            : status.toUpperCase(),
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
    filters.open,
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
  if (filters.open) params.set("open", "1")
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
 * Two parameters are always on, because they say what this queue is rather
 * than narrow it: `excludeType` takes out the checks it no longer carries
 * (`DROPPED_TYPES`), counts included, and `actionableOnly` leaves out lines
 * raised before the control existed, which are a reason rather than work. The
 * second filters nothing until VZI supplies the cutover date.
 */
function exceptionQuery(filters: ExceptionFilters): ExceptionQuery {
  return {
    q: filters.q,
    type: filters.type,
    plant: filters.plant,
    openOnly: filters.open || undefined,
    status: filters.status,
    repair: filters.repair,
    actionableOnly: true,
    excludeType: [...DROPPED_TYPES].join(","),
  }
}

/** Neither a dropped type nor a pre-automation line. The backend leaves both
 *  out already; this guards one older than paging, which ignores the two
 *  parameters. On the current one it removes nothing. */
function shown(row: ExceptionQueueRow): boolean {
  return !DROPPED_TYPES.has(row.type) && !row.preAutomation
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
  return { plants, types: [...types].filter((t) => !DROPPED_TYPES.has(t)).sort() }
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
  // The backend has taken the dropped types off the counts already. This
  // takes them out of `typesRaised` and `byType` for one that has not.
  const summary = withoutDroppedTypes(toSummary(body.meta), [])
  return { rows, total: body.total, summary, facets: facetsOf(body, rows, summary.typesRaised) }
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
