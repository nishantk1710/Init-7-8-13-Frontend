import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { loadLiveLedger } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { formatCount } from "@/lib/utils"

/**
 * The Utilization Ledger (FR-5).
 *
 * An async server component, and async only so it can fetch — the same split
 * Initiative 8's register uses:
 *
 *   this page                 fetches, on the server, once
 *   UtilizationLedgerTable    "use client", filters rows it is handed
 *
 * It replaces a `"use client"` page that fetched through `useI13Query` after
 * hydration. Three things follow from the move, and the third is the one that
 * matters beyond this screen:
 *
 *   - no request waterfall: the HTML arrives with the rows in it;
 *   - the plant/material filters live in the URL, so a filtered ledger is a
 *     link somebody can send; and
 *   - `router.refresh()` now works. Against the old page it did nothing at all,
 *     because the rows lived in `useState` inside a client component — which is
 *     why an assistant session could never update anything here.
 *
 * **Live-only, with no fixture fallback.** A ledger of invented document chains
 * is worse than an honest failure: the point of the screen is that the chain is
 * what SAP actually recorded.
 */
export async function UtilizationLedgerPage({
  searchParams,
}: {
  searchParams: I13SearchParams
}) {
  // Opt out of static prerendering. Without it `next build` fetches the ledger
  // once, bakes it into HTML, and serves whatever the data looked like at build
  // time forever -- so a reservation raised afterwards never appears.
  await connection()

  // The try/catch wraps ONLY the fetch. Building JSX inside it would put the
  // render under the same handler as the request, so an error thrown while
  // rendering would be reported as a failed load -- the opposite of this page's
  // point about telling the two apart.
  let live: Awaited<ReturnType<typeof loadLiveLedger>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveLedger({
      plant: searchParams.plant,
      material: searchParams.material,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const unmatched = live?.linkageCounts.UNMATCHED ?? 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilization Ledger"
          description={
            live
              ? `${formatCount(live.count)} OAR reservation lines, each anchored from reservation through goods issue. ` +
                `${formatCount(unmatched)} could not be stitched and are shown as unmatched rather than inferred.`
              : "Every OAR purchase-requisition item, anchored end-to-end from reservation through goods issue."
          }
        />

        <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

        {live === null ? (
          // Shown as a failure, never as an empty table. "No reservations" and
          // "cannot reach the server" must not look alike.
          <LoadFailure what="utilization ledger" message={loadError} />
        ) : (
          <>
            <UtilizationLedgerTable entries={live.rows} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="ledger line" />
          </>
        )}

        <DataSourcePanel />
      </div>
    </div>
  )
}
