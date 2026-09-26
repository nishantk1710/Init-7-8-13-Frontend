import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { GrniTable } from "@/features/initiative-13/components/grni-table"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLiveGrni } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatCount } from "@/lib/utils"

/**
 * 30-Day GR-Not-Issued — FRS FR-6, per reservation line.
 *
 * WATCH flags a material-plant when any of its reservation lines has been
 * received and not issued for the threshold (30 days by default). This screen
 * lists those lines themselves, oldest receipt first, so a storeman can see
 * which receipt is sitting on the shelf rather than only that one is.
 *
 * Served from the backend's I13 snapshot (`GET /i13/grni`); nothing is computed
 * here.
 */
export async function GrniPage({ searchParams }: { searchParams: I13SearchParams }) {
  await connection()

  let live: Awaited<ReturnType<typeof loadLiveGrni>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveGrni({ plant: searchParams.plant, material: searchParams.material })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="30-Day GR-Not-Issued"
          description={
            live
              ? `${formatCount(live.total ?? live.count)} OAR reservation lines received and not issued for 30 days or more, oldest receipt first.`
              : "OAR reservation lines received into stock and not issued for 30 days or more (FR-6)."
          }
        />

        <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

        {live === null ? (
          <LoadFailure what="30-day GR-not-issued list" message={loadError} />
        ) : (
          <>
            <GrniTable rows={live.rows} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="reservation line" />
            <p className="text-[11px] text-muted-foreground">
              Outstanding across the lines shown: {formatCount(live.outstandingQuantity)} units. The
              same rule marks a material &ldquo;GRNI&rdquo; on the WATCH screen.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
