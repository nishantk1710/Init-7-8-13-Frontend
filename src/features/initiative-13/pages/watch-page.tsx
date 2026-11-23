import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { TablePagination } from "@/components/shared/table-pagination"
import { DataUpdatedNote } from "@/features/initiative-13/components/data-updated-note"
import { DashboardInfo } from "@/features/initiative-13/components/dashboard-info"
import { GrniTable } from "@/features/initiative-13/components/grni-table"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { OarPageHeader, OarScope, ToolbarRow } from "@/features/initiative-13/components/ui/oar-scope"
import { SegmentedTabs } from "@/features/initiative-13/components/ui/segmented-tabs"
import { UsagePatternView } from "@/features/initiative-13/components/usage-pattern-view"
import { loadLiveGrni, loadLiveUsagePatterns } from "@/features/initiative-13/data/live-loaders"
import { pageHref, type I13SearchParams } from "@/features/initiative-13/utils/search-params"
import {
  WATCH_VIEWS,
  WATCH_VIEW_LABELS,
  parseWatchView,
  watchViewHref,
  type WatchView,
} from "@/features/initiative-13/utils/watch-view"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { formatCount } from "@/lib/utils"

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
 * WATCH — FR-1 and FR-6's metrics, per material and plant, in two tabs.
 *
 *   - **Usage Pattern** (default): month-by-month net issues with stock, cover,
 *     turns and days since movement (`GET /i13/usage-patterns`).
 *   - **30-Day GR-Not-Issued** (`?view=grni`): the reservation lines behind
 *     WATCH's GRNI flag, oldest receipt first (`GET /i13/grni`).
 *
 * The Metrics tab (one row per material and plant from the W6.3 mart) was
 * removed in UAT on 18-Nov-2026; an old `?view=metrics` link opens Usage.
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
    <OarScope>
      {view === "grni" ? (
        <GrniView searchParams={searchParams} />
      ) : (
        <UsageView searchParams={searchParams} />
      )}
    </OarScope>
  )
}

/** Usage Pattern | 30-Day GR-Not-Issued. A tab opens with its filters cleared. */
function WatchTabs({ active }: { active: WatchView }) {
  return (
    <SegmentedTabs
      label="Consumption tracking view"
      tabs={WATCH_VIEWS.map((view) => ({
        href: watchViewHref(view),
        label: WATCH_VIEW_LABELS[view],
        active: view === active,
      }))}
    />
  )
}

/**
 * 30-Day GR-Not-Issued — FR-6, per PO line.
 *
 * WATCH flags a material-plant when any of its PO lines has been received and
 * not (fully) issued for the threshold (30 days by default). This tab lists
 * those lines themselves, showing only what SAP records against a PO line: the
 * goods receipt. Why the issued quantity is not shown is in the tab's (i).
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
      <OarPageHeader
        title="Live Consumption Tracking"
        meta={<DataUpdatedNote />}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {live
              ? `${formatCount(live.total ?? live.count)} OAR PO lines received 30 or more days ago and not, or only partly, issued — oldest receipt first.`
              : "OAR PO lines received 30 or more days ago and not, or only partly, issued."}
            <DashboardInfo id="grniTab" />
          </span>
        }
      />
      <ToolbarRow>
        <WatchTabs active="grni" />
        <I13UrlFilters className="flex-1" fields={["plant", "material"]} plants={live?.plantOptions} />
      </ToolbarRow>

      {live === null ? (
        <LoadFailure what="30-day GR-not-issued list" message={loadError} />
      ) : (
        <>
          <GrniTable rows={live.rows} />
          <Pager searchParams={searchParams} total={live.total} count={live.count} noun="PO lines" />
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
      <OarPageHeader
        title="Live Consumption Tracking"
        meta={<DataUpdatedNote />}
        subtitle="How each OAR spare has actually been issued, month by month — steady, in bursts, or not lately."
      />
      <ToolbarRow>
        <WatchTabs active="usage" />
        <I13UrlFilters className="flex-1" fields={["plant", "material", "agingBand"]} plants={live?.plantOptions} />
      </ToolbarRow>

      {from && to && (
        <AlertBanner tone="info" title={`History covers ${from} to ${to}`}>
          That is the whole of the delivered movement extract. Enough to see a
          material&rsquo;s shape; too short to call a trend. A material with no
          goods movement in that time has nothing to show here, so it is not
          listed: it is on the Consumption tab and the dashboard&rsquo;s
          Non-movers tab.
        </AlertBanner>
      )}

      {live === null ? (
        <LoadFailure what="usage patterns" message={loadError} />
      ) : (
        <>
          <UsagePatternView rows={live.rows} />
          <Pager searchParams={searchParams} total={live.total} count={live.count} noun="material-plants" />
        </>
      )}
    </>
  )
}
