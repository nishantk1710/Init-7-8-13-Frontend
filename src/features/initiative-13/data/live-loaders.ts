/**
 * Initiative 13's live data layer — the server-side half of every OAR screen.
 *
 * This is the file Initiative 8's `data/live-*.ts` set is the model for. The
 * pattern, and why each part of it is there:
 *
 *   the page (server component)   fetches once, on the server, via a loader here
 *   the loader                    calls `lib/api/i13`, derives filter options
 *   the table ("use client")      renders rows it is handed, and filters them
 *
 * Every loader **throws on failure**. The caller catches and renders that
 * visibly, because an empty table and an unreachable backend are different
 * statements and one must never be shown as the other. That rule is the whole
 * reason these return data rather than a result object.
 *
 * ## Why filter options are derived here
 *
 * Because the alternative is a free-text box. The screens used to ask for a
 * plant by typing its code into an `<Input>` and debouncing the request — which
 * works only if you already know the codes. The rows know which plants and
 * aging bands are actually present, so the loaders collect them and the filters
 * become a list of what exists. Same reasoning as I8's `plantOptions` /
 * `vendorOptions`.
 *
 * ## Row caps and totals
 *
 * These loaders ask for `ROW_CAP` rows. The I13 list routes keep bare-array
 * bodies but now report the unpaged population in `X-Total-Count`, so a capped
 * screen can say "the first 1,000 of 42,649" rather than "there may be more".
 * `total` is `null` only for a route that does not send the header, and then
 * `atLimit` is still the honest fallback. The ledger route has always defaulted
 * `limit` to 100, which is why every loader here sends one explicitly.
 */

import {
  getI13ActExceptionsList,
  getI13ActUtilisationList,
  getI13ConsumptionPlans,
  getI13Grni,
  getI13LedgerList,
  getI13ReclassificationList,
  getI13Summary,
  getI13UsagePatterns,
  getI13Validation,
  type ActException,
  type ConsumptionPlan,
  type GrniEntry,
  type I13Summary,
  type ReclassificationCandidate,
  type UsagePattern,
  type UtilisationLedgerEntry,
  type ValidationResult,
  type WatchMetric,
} from "@/lib/api/i13"
import { listSessions, type ApiSessionSummary } from "@/lib/api/assistant"

/**
 * How many rows one screen asks the backend for.
 *
 * The point past which a table stops being readable and starts being a denial
 * of service against the browser. It matters on real data rather than in
 * theory: the WATCH mart holds 7,184 rows against an OAR population of 44,394,
 * and detection has raised 42,649 exceptions.
 *
 * 1,000 is also the ledger route's own maximum, so this is the largest single
 * request every I13 list route will honour.
 */
export const ROW_CAP = 1000

export type Capped<T> = {
  rows: T[]
  /** How many came back. */
  count: number
  /** The whole filtered population, from `X-Total-Count`. `null` if not sent. */
  total: number | null
  /**
   * More rows exist than came back. Exact when `total` is known; otherwise the
   * response came back exactly full, which only means "there may be more".
   */
  atLimit: boolean
}

function cap<T>(rows: T[], total: number | null = null): Capped<T> {
  return {
    rows,
    count: rows.length,
    total,
    atLimit: total !== null ? total > rows.length : rows.length >= ROW_CAP,
  }
}

/** Distinct plant codes present in the rows, sorted. */
function plantsOf(rows: { plant: string }[]): string[] {
  return [...new Set(rows.map((r) => r.plant).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

/**
 * The newest `calculatedAt` across the WATCH rows, or null.
 *
 * This is how stale the screen is, and on I13 that is not a detail: nothing
 * recomputes on its own. There is no scheduler, so every number on every OAR
 * screen dates from the last time somebody ran detection. A dashboard that does
 * not say when that was is inviting a reader to assume "now".
 */
export function newestCalculatedAt(rows: WatchMetric[]): string | null {
  let newest: string | null = null
  for (const row of rows) {
    if (row.calculatedAt && (newest === null || row.calculatedAt > newest)) {
      newest = row.calculatedAt
    }
  }
  return newest
}

export type WatchFilters = {
  plant?: string
  material?: string
  agingBand?: string
  acquiredVsPlanStatus?: string
}

export type LiveWatch = Capped<WatchMetric> & {
  plantOptions: string[]
  agingBandOptions: string[]
  /** Newest `calculatedAt` in the set. Null when no row carries one. */
  calculatedAt: string | null
}

/**
 * WATCH, adapted.
 *
 * Reads `/i13/act/utilisation`: every OAR material-plant's WATCH row from the
 * backend's I13 snapshot, with the GRNI and acquired-vs-plan filters the
 * dashboard needs. A plan captured through the assistant updates its material's
 * row as soon as the conversation completes.
 */
export async function loadLiveWatch(filters: WatchFilters = {}): Promise<LiveWatch> {
  const { items: rows, total } = await getI13ActUtilisationList({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    agingBand: filters.agingBand || undefined,
    acquiredVsPlanStatus: filters.acquiredVsPlanStatus || undefined,
    limit: ROW_CAP,
  })
  const capped = cap(rows, total)
  return {
    ...capped,
    plantOptions: plantsOf(rows),
    agingBandOptions: [...new Set(rows.map((r) => r.agingBand))].sort(),
    calculatedAt: newestCalculatedAt(rows),
  }
}

export type LedgerFilters = { plant?: string; material?: string }

export type LiveLedger = Capped<UtilisationLedgerEntry> & {
  plantOptions: string[]
  /** How many rows reached each linkage state — FRS AC-3's "reported, not inferred". */
  linkageCounts: Record<string, number>
}

export async function loadLiveLedger(filters: LedgerFilters = {}): Promise<LiveLedger> {
  const { items: rows, total } = await getI13LedgerList({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    limit: ROW_CAP,
  })
  const linkageCounts: Record<string, number> = {}
  for (const row of rows) {
    linkageCounts[row.linkageStatus] = (linkageCounts[row.linkageStatus] ?? 0) + 1
  }
  return { ...cap(rows, total), plantOptions: plantsOf(rows), linkageCounts }
}

export type ActExceptionFilters = {
  plant?: string
  material?: string
  type?: string
  status?: string
}

export type LiveActExceptions = Capped<ActException> & {
  plantOptions: string[]
  /** Exceptions that have somebody to route to. See the note below. */
  ownedCount: number
  sessionsByKey: Map<string, ApiSessionSummary[]>
}

/**
 * The ACT exception queue — FR-9's, not the ephemeral one.
 *
 * Also joins the assistant's session log, so a row can link to the conversation
 * that produced it. Two sources of that link:
 *
 *   - `exception.sessionId`, present on exceptions raised from a captured plan
 *     or a quantity decision; and
 *   - a `(material, plant)` lookup into the session log, for the rest.
 *
 * The session log is fetched **once** for the whole screen, not once per row.
 * A per-row lookup is the shape that turned the justification log into thirty
 * requests, and there is no reason to repeat it here.
 *
 * `ownedCount` is worth rendering. An exception with no owner routes to nobody
 * and escalates to nobody, so it is inert — and until W6.4's requester was
 * wired into detection, every `NO_PLAN` exception was in that state.
 */
export async function loadLiveActExceptions(
  filters: ActExceptionFilters = {}
): Promise<LiveActExceptions> {
  const [{ items: rows, total }, sessions] = await Promise.all([
    getI13ActExceptionsList({
      plant: filters.plant || undefined,
      material: filters.material || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined,
      limit: ROW_CAP,
    }),
    // Best-effort: the queue is the primary fetch, and the assistant being
    // unreachable should not take the exception screen down over a link.
    listSessions({ flow: "i13", limit: 200 }).catch(() => null),
  ])

  const sessionsByKey = new Map<string, ApiSessionSummary[]>()
  for (const session of sessions?.items ?? []) {
    const key = sessionKey(session.materialId, session.plant)
    const existing = sessionsByKey.get(key)
    if (existing) existing.push(session)
    else sessionsByKey.set(key, [session])
  }

  return {
    ...cap(rows, total),
    plantOptions: plantsOf(rows),
    ownedCount: rows.filter((r) => r.ownerRequesterId).length,
    sessionsByKey,
  }
}

/** The join key for session ↔ row. Material and plant together, never either alone. */
export function sessionKey(material: string, plant: string): string {
  return `${material}::${plant}`
}

export type LiveReclassification = Capped<ReclassificationCandidate> & {
  plantOptions: string[]
  candidateCount: number
  /** Every OAR material-plant position assessed, candidates or not. */
  positionCount: number | null
}

/**
 * The reclassification candidates — the positions that meet the SOP threshold.
 *
 * Only the candidates are fetched as rows (a few hundred), with the size of the
 * whole assessed population read from a one-row request's total. This screen
 * used to request all ~44,000 assessed positions with no limit and filter them
 * in the browser.
 */
export async function loadLiveReclassification(
  filters: LedgerFilters = {},
  options: { allPositions?: boolean } = {}
): Promise<LiveReclassification> {
  const scope = { plant: filters.plant || undefined, material: filters.material || undefined }
  if (options.allPositions) {
    // Every assessed position, unbounded -- for the dashboard, which joins the
    // critical-impact indicator onto its non-mover rows and needs the "No"s as
    // well as the candidates. Served from the snapshot, so this is fast.
    const all = await getI13ReclassificationList(scope)
    return {
      ...cap(all.items, all.total),
      atLimit: false,
      plantOptions: plantsOf(all.items),
      candidateCount: all.items.filter((r) => r.candidateFlag).length,
      positionCount: all.items.length,
    }
  }
  const [candidates, population] = await Promise.all([
    getI13ReclassificationList({ ...scope, candidatesOnly: true, limit: ROW_CAP }),
    getI13ReclassificationList({ ...scope, limit: 1 }),
  ])
  const rows = candidates.items
  return {
    ...cap(rows, candidates.total),
    plantOptions: plantsOf(rows),
    candidateCount: candidates.total ?? rows.length,
    positionCount: population.total,
  }
}

export type LivePlans = Capped<ConsumptionPlan> & {
  plantOptions: string[]
}

/**
 * Consumption plans captured through the assistant — FR-4's evidence.
 *
 * Every row here was stated by a person in a conversation. The 742
 * `REFERENCE_CSV` rows that most acquired-vs-plan figures still rest on are
 * **not** in this list, by design: the backend keeps them apart, and the whole
 * value of this screen is being able to say which is which.
 */
export async function loadLivePlans(filters: LedgerFilters = {}): Promise<LivePlans> {
  const rows = await getI13ConsumptionPlans({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    limit: 500,
  })
  return { ...cap(rows), plantOptions: plantsOf(rows) }
}

export function loadLiveSummary(): Promise<I13Summary> {
  return getI13Summary()
}

export function loadLiveValidation(params: {
  zmm065ReferenceCount?: number
  gr30DayReferenceCount?: number
}): Promise<ValidationResult> {
  return getI13Validation(params)
}

export type LiveGrni = Capped<GrniEntry> & {
  plantOptions: string[]
  /** Outstanding quantity summed over the rows shown. */
  outstandingQuantity: number
}

/**
 * Goods received and not issued for 30+ days, per reservation line, oldest
 * first — FRS FR-6, the same rule WATCH applies per material and plant.
 */
export async function loadLiveGrni(filters: LedgerFilters & { minDays?: number } = {}): Promise<LiveGrni> {
  const { items: rows, total } = await getI13Grni({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    minDays: filters.minDays,
    limit: ROW_CAP,
  })
  return {
    ...cap(rows, total),
    plantOptions: plantsOf(rows),
    outstandingQuantity: rows.reduce((sum, r) => sum + r.outstandingQuantity, 0),
  }
}

export type LiveUsagePatterns = Capped<UsagePattern> & {
  plantOptions: string[]
  /** e.g. `2025-08..2026-08` — how deep the delivered movement history goes. */
  historyMonths: string | null
}

/** Month-by-month goods issues per OAR material and plant, most issued first. */
export async function loadLiveUsagePatterns(
  filters: LedgerFilters & { agingBand?: string } = {}
): Promise<LiveUsagePatterns> {
  const { items: rows, total, historyMonths } = await getI13UsagePatterns({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    agingBand: filters.agingBand || undefined,
    limit: 200,
  })
  return { ...cap(rows, total), plantOptions: plantsOf(rows), historyMonths }
}
