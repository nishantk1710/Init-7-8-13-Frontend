/**
 * Initiative 13's filters live in the URL.
 *
 * ## Why, when Initiative 8's do not
 *
 * I8's register fetches all 1,225 rows once and filters them in the browser
 * with `useMemo`. That is the simpler pattern and it is right there. It does not
 * transfer: the WATCH mart holds 7,184 rows today against an OAR population of
 * 44,394, and `/api/i13/*` already filters server-side. Pulling the whole
 * population into a browser to filter it there would be a worse screen, not a
 * simpler one.
 *
 * So the server component does the fetching, which means the filter state has
 * to be somewhere the server can read: `searchParams`. Three things follow, and
 * two of them are improvements rather than costs.
 *
 *   - A filtered dashboard becomes a **link somebody can send**. On a screen
 *     built for UAT that is worth more than it sounds — "look at 1500's
 *     non-movers" stops being a set of instructions.
 *   - Back and forward work through filter changes, for free.
 *   - The filter controls stay client components, because typing is client
 *     work. They write the URL; they do not hold the answer.
 */

/** What every OAR screen can be narrowed by. Not every screen uses all of them. */
export type I13SearchParams = {
  plant?: string
  material?: string
  agingBand?: string
  acquiredVsPlanStatus?: string
  type?: string
  status?: string
  zmm065?: number
  gr30Day?: number
  /** Ledger screen: `reservations` shows the reservation-anchored ledger. */
  view?: string
  /** Ledger screen: only reservations whose item text names this session. */
  session?: string
}

/** Next hands `searchParams` as a promise of possibly-repeated values. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * One value, or undefined.
 *
 * A repeated parameter is a malformed link rather than a list to guess from —
 * `?plant=1300&plant=1500` has no defensible single answer, so it gets none.
 * Same rule the assistant's deep-link route applies.
 */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function positiveInt(value: string | string[] | undefined): number | undefined {
  const raw = single(value)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  // NaN and negatives are dropped rather than sent on. A reconciliation
  // reference count of -1 would come back as a confident variance against a
  // number nobody supplied.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function parseSearchParams(raw: RawSearchParams): I13SearchParams {
  return {
    plant: single(raw.plant),
    material: single(raw.material),
    agingBand: single(raw.agingBand),
    acquiredVsPlanStatus: single(raw.acquiredVsPlanStatus),
    type: single(raw.type),
    status: single(raw.status),
    zmm065: positiveInt(raw.zmm065),
    gr30Day: positiveInt(raw.gr30Day),
    view: single(raw.view),
    session: single(raw.session),
  }
}

/**
 * Merge a patch into a query string, dropping anything emptied.
 *
 * An empty value removes the key rather than sending `?plant=`, so a cleared
 * filter produces the same URL as one that was never set. Two URLs meaning the
 * same thing is how a "no results" bug that only reproduces on a shared link
 * gets made.
 */
export function mergeSearchParams(
  current: URLSearchParams | Readonly<URLSearchParams>,
  patch: Record<string, string | number | undefined | null>
): string {
  const next = new URLSearchParams(current.toString())
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") next.delete(key)
    else next.set(key, String(value))
  }
  return next.toString()
}

/** True when nothing is set — for an "all positions" vs "filtered" caption. */
export function isUnfiltered(params: I13SearchParams): boolean {
  return Object.values(params).every((value) => value === undefined)
}
