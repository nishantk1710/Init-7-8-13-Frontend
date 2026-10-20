/**
 * The Utilisation Dashboard's whole data layer — W6.7, FR-10.
 *
 * One server-side fetch for six sections, where there used to be six client
 * hooks firing after hydration and re-firing on every debounced keystroke.
 *
 * ## Where `useI13OptionalQuery`'s semantics went
 *
 * They moved here, unchanged in meaning. That hook existed to tell two failures
 * apart:
 *
 *   - **404** — the backend genuinely does not offer this capability in this
 *     environment (a W6.3-only deployment has no W6.5/W6.6), which is not an
 *     error and has nothing to retry; and
 *   - **anything else** — a request that failed and should be retried.
 *
 * One missing downstream capability must not read as a broken dashboard. So
 * every optional section is settled independently with `Promise.allSettled` and
 * classified by the same rule, on the server.
 *
 * The dashboard's one **official** dependency is W6.3 (WATCH). If that fails,
 * the page says so; everything else degrades on its own.
 */

import { ApiError } from "@/lib/api/client"
import {
  getI13AllJustifications,
  type ActExceptionCounts,
  type I13Summary,
  type WatchCounts,
} from "@/lib/api/i13"
import { listSummaryReports } from "@/lib/api/i13-report"
import type { UnifiedJustification } from "@/lib/assistant/justifications"
import {
  loadLiveExceptionCounts,
  loadLivePlans,
  loadLiveReclassification,
  loadLiveSummary,
  loadLiveWatch,
  loadLiveWatchCounts,
  type LivePlans,
  type LiveReclassification,
  type LiveWatch,
  type Paging,
} from "@/features/initiative-13/data/live-loaders"
import type { DetailTabId } from "@/features/initiative-13/utils/detail-tabs"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"

/** A section that is allowed to be missing without the page being broken. */
export type Section<T> =
  | { status: "ready"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

const UNAVAILABLE =
  "This capability is not available from the current backend."

/**
 * Settle one optional section.
 *
 * A 404 is `unavailable`; everything else is `error`. Exactly the rule
 * `useI13OptionalQuery` applied in the browser — a missing capability offers
 * nothing to retry, and rendering it as a failure trains people to ignore real
 * ones.
 */
async function section<T>(promise: Promise<T>): Promise<Section<T>> {
  try {
    return { status: "ready", data: await promise }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "unavailable", message: UNAVAILABLE }
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to load data.",
    }
  }
}

export type DashboardFilters = {
  plant?: string
  material?: string
  agingBand?: string
  acquiredVsPlanStatus?: string
}

export type LiveDashboard = {
  /**
   * The one official dependency: WATCH totals, for the plan-coverage bar and
   * the tab badges. Counted by the backend over every OAR row the filters
   * match. Null means the page cannot render its core.
   */
  watchCounts: WatchCounts | null
  /** The acquired-vs-plan tab: one page of WATCH rows, most recent activity first. */
  watch: LiveWatch | null
  watchError: string | null
  /** The non-movers tab: one page of NON_MOVING rows, most recent activity first. */
  nonMovers: LiveWatch | null
  summary: Section<I13Summary>
  reclassification: Section<LiveReclassification>
  exceptionCounts: Section<ActExceptionCounts>
  justifications: Section<UnifiedJustification[]>
  plans: Section<LivePlans>
  /** Whether the backend offers the summary report (`I13_REPORT_ENABLED`).
   * Any failure reads as "not offered": the button is a convenience, and a
   * broken check must never cost the dashboard. */
  reportEnabled: boolean
}

/** Nothing to fetch: an aging-band filter other than NON_MOVING leaves no non-movers. */
const NO_ROWS: LiveWatch = {
  rows: [],
  count: 0,
  total: 0,
  atLimit: false,
  plantOptions: [],
  agingBandOptions: [],
  calculatedAt: null,
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The dashboard's data, one page per tab.
 *
 * The bars and badges come from count endpoints, so they describe every row
 * the filters match. The tables load one page of 25 each: the active tab
 * (`?tab=`) at `?page=`, the others at page 1 -- a tab opened without a
 * navigation shows its first page, and its pager links carry its own `tab`.
 */
export async function loadLiveDashboard(
  filters: DashboardFilters = {},
  view: { tab: DetailTabId; page: number } = { tab: "non-movers", page: 1 }
): Promise<LiveDashboard> {
  const scope = { plant: filters.plant, material: filters.material }
  const pageOf = (tab: DetailTabId): Paging => ({
    page: view.tab === tab ? view.page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const nonMoverFilter = !filters.agingBand || filters.agingBand === "NON_MOVING"

  // All in flight together. Sequentially this would be eight round trips deep
  // on a screen whose whole job is to be glanced at.
  const [counts, watch, nonMovers, summary, reclassification, exceptionCounts, justifications, plans, reportEnabled] =
    await Promise.all([
      loadLiveWatchCounts(filters).then(
        (data) => ({ ok: true as const, data }),
        (error: unknown) => ({ ok: false as const, message: failure(error) })
      ),
      loadLiveWatch(filters, pageOf("plan")).catch(() => null),
      nonMoverFilter
        ? loadLiveWatch({ ...filters, agingBand: "NON_MOVING" }, pageOf("non-movers")).catch(() => null)
        : Promise.resolve(NO_ROWS),
      section(loadLiveSummary(scope)),
      section(loadLiveReclassification(scope, { allPositions: true })),
      section(loadLiveExceptionCounts(scope)),
      section(getI13AllJustifications(scope)),
      section(loadLivePlans(scope, pageOf("plans"))),
      listSummaryReports({ limit: 1 }).then(
        () => true,
        () => false
      ),
    ])

  return {
    watchCounts: counts.ok ? counts.data : null,
    watch: counts.ok ? watch : null,
    watchError: counts.ok ? (watch ? null : "Unable to load consumption tracking rows.") : counts.message,
    nonMovers,
    summary,
    reclassification,
    exceptionCounts,
    justifications,
    plans,
    reportEnabled,
  }
}
