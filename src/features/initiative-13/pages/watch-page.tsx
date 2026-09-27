import Link from "next/link"
import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { GrniTable } from "@/features/initiative-13/components/grni-table"
import {
  CalculatedAtNote,
  LoadFailure,
  RowCapNote,
} from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { UsagePatternTable } from "@/features/initiative-13/components/usage-pattern-table"
import { WatchTable } from "@/features/initiative-13/components/watch-table"
import {
  loadLiveGrni,
  loadLiveUsagePatterns,
  loadLiveWatch,
} from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import {
  WATCH_VIEWS,
  WATCH_VIEW_LABELS,
  parseWatchView,
  watchViewHref,
  type WatchView,
} from "@/features/initiative-13/utils/watch-view"
import { listSessions, type ApiSessionSummary } from "@/lib/api/assistant"
import { cn, formatCount } from "@/lib/utils"

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
      loadLiveWatch({
        plant: searchParams.plant,
        material: searchParams.material,
        agingBand: searchParams.agingBand,
        acquiredVsPlanStatus: searchParams.acquiredVsPlanStatus,
      }),
      listSessions({ flow: "i13", limit: 200 }).catch(() => null),
    ])
    live = watch
    sessions = sessionList?.items ?? []
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

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
        title="WATCH"
        description="Backend-computed utilisation health per material and plant — months of cover, aging band, GR-not-issued, and acquired-vs-plan status."
        actions={<CalculatedAtNote calculatedAt={live?.calculatedAt ?? null} />}
      />
      <WatchTabs searchParams={searchParams} active="metrics" />

      <I13UrlFilters
        fields={["plant", "material", "agingBand", "acquiredVsPlanStatus"]}
        plants={live?.plantOptions}
        agingBands={live?.agingBandOptions}
      />

      {live === null ? (
        <LoadFailure what="WATCH data" message={loadError} />
      ) : (
        <>
          <WatchTable metrics={live.rows} sessionsByKey={sessionsByKey} />
          <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="WATCH position" />
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
    live = await loadLiveGrni({ plant: searchParams.plant, material: searchParams.material })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <>
      <PageHeader
        title="WATCH"
        description={
          live
            ? `${formatCount(live.total ?? live.count)} OAR reservation lines received and not issued for 30 days or more, oldest receipt first.`
            : "OAR reservation lines received into stock and not issued for 30 days or more (FR-6)."
        }
      />
      <WatchTabs searchParams={searchParams} active="grni" />

      <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

      {live === null ? (
        <LoadFailure what="30-day GR-not-issued list" message={loadError} />
      ) : (
        <>
          <GrniTable rows={live.rows} />
          <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="reservation line" />
          <p className="text-[11px] text-muted-foreground">
            Outstanding across the lines shown: {formatCount(live.outstandingQuantity)} units. The
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
    live = await loadLiveUsagePatterns({
      plant: searchParams.plant,
      material: searchParams.material,
      agingBand: searchParams.agingBand,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const [from, to] = live?.historyMonths?.split("..") ?? []

  return (
    <>
      <PageHeader
        title="WATCH"
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
          <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="material-plant" />
        </>
      )}
    </>
  )
}
