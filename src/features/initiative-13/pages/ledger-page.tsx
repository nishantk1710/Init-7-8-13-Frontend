import Link from "next/link"
import { connection } from "next/server"

import { PageHeader } from "@/components/shared/page-header"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import { LoadFailure, RowCapNote } from "@/features/initiative-13/components/load-states"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { ReservationLedgerTable } from "@/features/initiative-13/components/reservation-ledger-table"
import { loadLiveLedger, loadLiveReservationLedger } from "@/features/initiative-13/data/live-loaders"
import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { cn, formatCount } from "@/lib/utils"

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

  const reservationsView = searchParams.view === "reservations" || Boolean(searchParams.session)

  return reservationsView ? (
    <ReservationsView searchParams={searchParams} />
  ) : (
    <ProcurementView searchParams={searchParams} />
  )
}

/** Procurement lines | Reservations, keeping the current filters. */
function ViewToggle({ searchParams, active }: { searchParams: I13SearchParams; active: "lines" | "reservations" }) {
  const base = new URLSearchParams()
  if (searchParams.plant) base.set("plant", searchParams.plant)
  if (searchParams.material) base.set("material", searchParams.material)
  const lines = base.toString()
  const reservations = new URLSearchParams(base)
  reservations.set("view", "reservations")
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      aria-current={on ? "page" : undefined}
    >
      {label}
    </Link>
  )
  return (
    <div className="inline-flex w-fit gap-1 rounded-lg border border-border p-1">
      {tab(`/oar-utilization/ledger${lines ? `?${lines}` : ""}`, "Procurement lines", active === "lines")}
      {tab(`/oar-utilization/ledger?${reservations.toString()}`, "Reservations", active === "reservations")}
    </div>
  )
}

async function ReservationsView({ searchParams }: { searchParams: I13SearchParams }) {
  let live: Awaited<ReturnType<typeof loadLiveReservationLedger>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveReservationLedger({
      plant: searchParams.plant,
      material: searchParams.material,
      session: searchParams.session,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilization Ledger"
          description={
            searchParams.session
              ? `Reservations whose item text carries session ${searchParams.session}.`
              : "Every OAR reservation item, with the assistant session its item text (SGTXT) names — the link from a reservation back to the advice given for it."
          }
        />
        <ViewToggle searchParams={searchParams} active="reservations" />
        <I13UrlFilters fields={["plant", "material"]} plants={live?.plantOptions} />

        {live === null ? (
          <LoadFailure what="reservation ledger" message={loadError} />
        ) : (
          <>
            <ReservationLedgerTable rows={live.rows} />
            <RowCapNote atLimit={live.atLimit} count={live.count} total={live.total} noun="reservation" />
            <p className="text-[11px] text-muted-foreground">
              {formatCount(live.linkedCount)} of the rows shown carry an assistant session ID in their item text.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

async function ProcurementView({ searchParams }: { searchParams: I13SearchParams }) {
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
              ? `${formatCount(live.count)} OAR procurement lines, each anchored from purchase requisition through goods issue. ` +
                `${formatCount(unmatched)} could not be stitched and are shown as unmatched rather than inferred.`
              : "Every OAR purchase-requisition item, anchored end-to-end from reservation through goods issue."
          }
        />
        <ViewToggle searchParams={searchParams} active="lines" />

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
