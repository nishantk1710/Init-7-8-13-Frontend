import { connection } from "next/server"

import { AlertBanner } from "@/components/shared/alert-banner"
import { PageHeader } from "@/components/shared/page-header"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { UsagePatternTable } from "@/features/initiative-13/components/usage-pattern-table"
import { loadLiveUsagePatterns } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"

/**
 * Usage pattern — month-by-month goods issues per OAR material and plant.
 *
 * Net issues (201/261 less their reversals), the same netting WATCH's
 * consumption uses, from the backend's I13 snapshot
 * (`GET /i13/usage-patterns`). Most-issued materials first.
 *
 * The history is only as deep as the delivered MSEG extract, and the header
 * says how deep that is: twelve-and-a-bit months is enough to see a pattern,
 * not enough to call a trend (blocker B4).
 */
export async function UsagePatternsPage({ searchParams }: { searchParams: I13SearchParams }) {
  await connection()

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
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Usage Pattern"
          description="How each OAR spare has actually been issued, month by month — steady, in bursts, or not lately."
        />

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
      </div>
    </div>
  )
}
