import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { TablePagination } from "@/components/shared/table-pagination"
import { GrniTable } from "@/features/initiative-13/components/grni-table"
import { CalculatedAtNote, LoadFailure } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { UsagePatternTable } from "@/features/initiative-13/components/usage-pattern-table"
import { WatchTable } from "@/features/initiative-13/components/watch-table"
import {
  loadLiveGrni,
  loadLiveUsagePatterns,
  loadLiveWatch,
} from "@/features/initiative-13/data/live-loaders"
import { pageHref, type I13SearchParams } from "@/features/initiative-13/utils/search-params"
import {
  WATCH_VIEWS,
  WATCH_VIEW_LABELS,
  parseWatchView,
  watchViewHref,
  type WatchView,
} from "@/features/initiative-13/utils/watch-view"
import { listSessions, type ApiSessionSummary } from "@/lib/api/assistant"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"

const PATH = "/oar-utilization/watch"

/** This tab's page of rows, from the URL. */
function pagingOf(searchParams: I13SearchParams) {
  return { page: searchParams.page ?? 1, pageSize: DEFAULT_PAGE_SIZE }
}

/**
 * Past the end — a stale link, or a population that shrank — goes to the last
 * page rather than an empty one. Called outside the fetch's try: redirect()
 * works by throwing, and that catch would report it as a failed load.
 */
function redirectIfPastEnd(searchParams: I13SearchParams, total: number | null | undefined) {
  const page = searchParams.page ?? 1
  if (total && page > pageCountOf(total, DEFAULT_PAGE_SIZE)) {
    redirect(pageHref(PATH, searchParams, pageCountOf(total, DEFAULT_PAGE_SIZE)))
  }
}

/** The pager under a tab's table; the tab's `view` rides along in the links. */
function Pager({
  searchParams,
  total,
  count,
  noun,
}: {
  searchParams: I13SearchParams
  total: number | null
  count: number
  noun: string
}) {
  return (
    <TablePagination
      page={searchParams.page ?? 1}
      pageSize={DEFAULT_PAGE_SIZE}
      total={total}
      count={count}
      noun={noun}
      hrefFor={(p) => pageHref(PATH, searchParams, p)}
    />
  )
}

/**
 * WATCH — FR-1 and FR-6's metrics, per material and plant, in three tabs.
 *
 *   - **Metrics** (default): the persisted W6.3 mart through
 *     `/i13/act/utilisation`, rather than `/i13/watch`, which recomputes the
 *     whole population on every request to answer a filtered question.
 *   - **30-Day GR-Not-Issued** (`?view=grni`): the reservation lines behind
 *     WATCH's GRNI flag, oldest receipt first (`GET /i13/grni`).
 *   - **Usage Pattern** (`?view=usage`): month-by-month net issues, the shape
 *     behind WATCH's consumption figure (`GET /i13/usage-patterns`).
 *
 * The last two were screens of their own; the FRS treats both as WATCH metrics.
 * The tab lives in the URL like every other I13 filter, and only the active
 * tab's data is fetched.
 *
 * Every number here is backend-computed. Nothing on this page reclassifies an
 * aging band, recalculates months of cover or re-derives GRNI — if it did, this
 * screen and the exception queue would disagree about the same part, in front
 * of a user, within a release.
 */
export async function WatchPage({ searchParams }: { searchParams: I13SearchParams }) {
  await connection()

  const view = parseWatchView(searchParams.view)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {view === "grni" ? (
          <GrniView searchParams={searchParams} />
        ) : view === "usage" ? (
          <UsageView searchParams={searchParams} />
        ) : (
          <MetricsView searchParams={searchParams} />
        )}
      </div>
    </div>
  )
}

/** Metrics | 30-Day GR-Not-Issued | Usage Pattern, keeping the current filters. */
function WatchTabs({ searchParams, active }: { searchParams: I13SearchParams; active: WatchView }) {
  return (
    <div className="inline-flex w-fit gap-1 rounded-lg border border-border p-1">
      {WATCH_VIEWS.map((view) => (
        <Link
          key={view}
          href={watchViewHref(view, searchParams)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            view === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-current={view === active ? "page" : undefined}
        >
          {WATCH_VIEW_LABELS[view]}
        </Link>
      ))}
    </div>
  )
}

async function MetricsView({ searchParams }: { searchParams: I13SearchParams }) {
  let live: Awaited<ReturnType<typeof loadLiveWatch>> | null = null
  let sessions: ApiSessionSummary[] = []
  let loadError: string | null = null
  try {
    // The mart is the primary fetch; the session log is a link and must not be
    // able to take the screen down, so its failure is swallowed.
    const [watch, sessionList] = await Promise.all([
      loadLiveWatch(
        {
          plant: searchParams.plant,
          material: searchParams.material,
          agingBand: searchParams.agingBand,
          acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
        },
        pagingOf(searchParams)
      ),
      listSessions({ flow: "i13", limit: 200 }).catch(() => null),
    ])
    live = watch
    sessions = sessionList?.items ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  redirectIfPastEnd(searchParams, live?.total)

  const sessionsByKey = new Map<string, ApiSessionSummary[]>()
  for (const session of sessions) {
    const key = `${session.materialId}::${session.plant}`
    const existing = sessionsByKey.get(key)
    if (existing) existing.push(session)
    else sessionsByKey.set(key, [session])
  }

  return (
    <>
      <PageHeader
        title="Live Consumption Tracking"
        description="Live consumption health per material and plant — months of cover, stock type, received-not-issued, and consumption plan status."
        actions={<CalculatedAtNote calculatedAt={live?.calculatedAt ?? null} />}
      />
      <WatchTabs searchParams={searchParams} active="metrics" />

      <I13UrlFilters
        fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
        plants={live?.plantOptions}
        agingBands={live?.agingBandOptions}
      />

      {live === null ? (
        <LoadFailure what="consumption tracking data" message={loadError} />
      ) : (
        <>
          <WatchTable metrics={live.rows} sessionsByKey={sessionsByKey} />
          <Pager searchParams={searchParams} total={live.total} count={live.count} noun="materials" />
        </>
      )}
    </>
  )
}

/**
 * 30-Day GR-Not-Issued — FR-6, per reservation line.
 *
 * WATCH flags a material-plant when any of its reservation lines has been
 * received and not issued for the threshold (30 days by default). This tab
 * lists those lines themselves, so a storeman can see which receipt is sitting
 * on the shelf rather than only that one is.
 */
async function GrniView({ searchParams }: { searchParams: I13SearchParams }) {
  let live: Awaited<ReturnType<typeof loadLiveGrni>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveGrni(
      { plant: searchParams.plant, material: searchParams.material },
      pagingOf(searchParams)
    )
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  redirectIfPastEnd(searchParams, live?.total)

  return (
    <>
      <PageHeader
        title="Live Consumption Tracking"
        description={
          live
            ? `${formatCount(live.total ?? live.count)} OAR reservation lines received and not issued for 30 days or more, oldest receipt first.`
            : "OAR reservation lines received into stock and not issued for 30 days or more."
        }
      />
      <WatchTabs searchParams={searchParams} active="grni" />

      <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

      {live === null ? (
        <LoadFailure what="30-day GR-not-issued list" message={loadError} />
      ) : (
        <>
          <GrniTable rows={live.rows} />
          <Pager searchParams={searchParams} total={live.total} count={live.count} noun="reservation lines" />
          <p className="text-[11px] text-muted-foreground">
            Outstanding across the lines on this page: {formatCount(live.outstandingQuantity)} units. The
            same rule marks a material &ldquo;GRNI&rdquo; on the Metrics tab.
          </p>
        </>
      )}
    </>
  )
}

/**
 * Usage pattern — month-by-month goods issues per OAR material and plant.
 *
 * Net issues (201/261 less their reversals), the same netting the Metrics tab's
 * consumption uses. Most-issued materials first.
 *
 * The history is only as deep as the delivered MSEG extract, and the banner
 * says how deep that is: twelve-and-a-bit months is enough to see a pattern,
 * not enough to call a trend (blocker B4).
 */
async function UsageView({ searchParams }: { searchParams: I13SearchParams }) {
  let live: Awaited<ReturnType<typeof loadLiveUsagePatterns>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveUsagePatterns(
      {
        plant: searchParams.plant,
        material: searchParams.material,
        agingBand: searchParams.agingBand,
      },
      pagingOf(searchParams)
    )
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  redirectIfPastEnd(searchParams, live?.total)

  const [from, to] = live?.historyMonths?.split("..") ?? []

  return (
    <>
      <PageHeader
        title="Live Consumption Tracking"
        description="How each OAR spare has actually been issued, month by month — steady, in bursts, or not lately."
      />
      <WatchTabs searchParams={searchParams} active="usage" />

      {from && to && (
        <AlertBanner tone="info" title={`History covers ${from} to ${to}`}>
          That is the whole of the delivered movement extract. Enough to see a
          material&rsquo;s shape; too short to call a trend.
        </AlertBanner>
      )}

      <I13UrlFilters fields={["plant", "material", "agingBand"]} plants={live?.plantOptions} />

      {live === null ? (
        <LoadFailure what="usage patterns" message={loadError} />
      ) : (
        <>
          <UsagePatternTable rows={live.rows} />
          <Pager searchParams={searchParams} total={live.total} count={live.count} noun="material-plants" />
        </>
      )}
    </>
  )
}
