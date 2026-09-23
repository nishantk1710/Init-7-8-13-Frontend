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
 * ## Why there is no pagination loop here, unlike I8's
 *
 * I8's register endpoint returns `ApiPage<T, TMeta>` with a `total`, so its
 * loader can page until it has everything and know when it is done. The I13
 * routes return bare arrays with a `limit`: there is no envelope, and therefore
 * no total to page towards.
 *
 * So these loaders ask for `ROW_CAP` rows and report `atLimit` when the
 * response came back exactly full — which means "there may be more", not "there
 * are this many". Callers render that sentence. The distinction matters: the
 * ledger route has always defaulted `limit` to 100, this client never sent one,
 * and the ledger screen had therefore been showing at most a hundred entries
 * while saying nothing about it. An undisclosed cap reads as the whole truth.
 */

import {
  getI13ActExceptions,
  getI13ActUtilisation,
  getI13ConsumptionPlans,
  getI13Ledger,
  getI13Reclassification,
  getI13Summary,
  getI13Validation,
  type ActException,
  type ConsumptionPlan,
  type I13Summary,
  type ReclassificationCandidate,
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
  /** How many came back. Not a population total — no I13 route serves one. */
  count: number
  /**
   * The response came back exactly full, so there may be more.
   *
   * Deliberately not called `truncated`: nothing here knows whether it is. Say
   * "the first 1,000" on screen, never "1,000 of N".
   */
  atLimit: boolean
}

function cap<T>(rows: T[]): Capped<T> {
  return { rows, count: rows.length, atLimit: rows.length >= ROW_CAP }
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
 * The WATCH mart, adapted.
 *
 * Reads `/i13/act/utilisation` — the **persisted** W6.3 mart — rather than
 * `/i13/watch`, which live-computes on every request. Both return the same
 * shape; the mart supports the GRNI and acquired-vs-plan filters the dashboard
 * needs, and does not recompute the whole population to answer a filtered
 * question.
 */
export async function loadLiveWatch(filters: WatchFilters = {}): Promise<LiveWatch> {
  const rows = await getI13ActUtilisation({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    agingBand: filters.agingBand || undefined,
    acquiredVsPlanStatus: filters.acquiredVsPlanStatus || undefined,
    limit: ROW_CAP,
  })
  const capped = cap(rows)
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
  const rows = await getI13Ledger({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
    limit: ROW_CAP,
  })
  const linkageCounts: Record<string, number> = {}
  for (const row of rows) {
    linkageCounts[row.linkageStatus] = (linkageCounts[row.linkageStatus] ?? 0) + 1
  }
  return { ...cap(rows), plantOptions: plantsOf(rows), linkageCounts }
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
  const [rows, sessions] = await Promise.all([
    getI13ActExceptions({
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
    ...cap(rows),
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
}

export async function loadLiveReclassification(
  filters: LedgerFilters = {}
): Promise<LiveReclassification> {
  const rows = await getI13Reclassification({
    plant: filters.plant || undefined,
    material: filters.material || undefined,
  })
  return {
    ...cap(rows),
    plantOptions: plantsOf(rows),
    candidateCount: rows.filter((r) => r.candidateFlag).length,
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
