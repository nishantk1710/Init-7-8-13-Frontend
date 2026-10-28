import { redirect } from "next/navigation"
import { connection } from "next/server"
import { ListChecks, MessagesSquare, Rows3, Unlink } from "lucide-react"

import { TablePagination } from "@/components/shared/table-pagination"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import { LoadFailure } from "@/features/initiative-13/components/load-states"
import { KpiCard } from "@/features/initiative-13/components/ui/kpi-card"
import { SegmentedBar, type BarSegment } from "@/features/initiative-13/components/ui/progress-bar"
import { TONE_FILL } from "@/features/initiative-13/components/ui/tones"
import { OarPageHeader, OarScope, ToolbarRow } from "@/features/initiative-13/components/ui/oar-scope"
import { SegmentedTabs } from "@/features/initiative-13/components/ui/segmented-tabs"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import { ReservationLedgerTable } from "@/features/initiative-13/components/reservation-ledger-table"
import { loadLiveLedger, loadLiveReservationLedger } from "@/features/initiative-13/data/live-loaders"
import { percentLabel } from "@/features/initiative-13/utils/oar-display"
import { pageHref, type I13SearchParams } from "@/features/initiative-13/utils/search-params"
import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"
import { cn, formatCount } from "@/lib/utils"

/**
 * How the lines are stitched, over every matching line (from `/ledger/counts`).
 * The issued / part-issued / not-issued split is not counted by the backend,
 * so the bar shows what is: the linkage the ledger reached.
 */
const LINKAGE_SEGMENTS: { key: string; label: string; tone: BarSegment["tone"] }[] = [
  { key: "FULL_CHAIN", label: "Full chain", tone: "healthy" },
  { key: "RESERVATION_LINKED", label: "Reservation linked", tone: "primary" },
  { key: "PR_ONLY", label: "PR only", tone: "neutral" },
  { key: "UNMATCHED", label: "Unmatched", tone: "caution" },
]

function LinkageBreakdown({ counts, total }: { counts: Record<string, number>; total: number }) {
  const segments = LINKAGE_SEGMENTS.map((s) => ({ ...s, count: counts[s.key] ?? 0 }))
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <SegmentedBar segments={segments} label="Procurement lines by linkage" className="h-3" />
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", TONE_FILL[s.tone])} />
            <span className="text-foreground">{s.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatCount(s.count)} · {percentLabel(s.count, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const PATH = "/oar-utilization/ledger"

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
  return (
    <SegmentedTabs
      label="Ledger view"
      tabs={[
        { href: `/oar-utilization/ledger${lines ? `?${lines}` : ""}`, label: "Procurement lines", active: active === "lines" },
        { href: `/oar-utilization/ledger?${reservations.toString()}`, label: "Reservations", active: active === "reservations" },
      ]}
    />
  )
}

/**
 * Server-paged: 105k reservation items is not a list to send to a browser, and
 * the route pages in SQL with a total.
 */
async function ReservationsView({ searchParams }: { searchParams: I13SearchParams }) {
  const page = searchParams.page ?? 1
  let live: Awaited<ReturnType<typeof loadLiveReservationLedger>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveReservationLedger(
      {
        plant: searchParams.plant,
        material: searchParams.material,
        session: searchParams.session,
        reservation: searchParams.reservation,
      },
      { page, pageSize: DEFAULT_PAGE_SIZE }
    )
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  // Past the end goes to the last page. Outside the try: redirect() throws.
  if (live?.total && page > pageCountOf(live.total, DEFAULT_PAGE_SIZE)) {
    redirect(pageHref(PATH, searchParams, pageCountOf(live.total, DEFAULT_PAGE_SIZE)))
  }

  return (
    <OarScope>
        <OarPageHeader
          title="Utilization Ledger"
          subtitle={
            searchParams.session
              ? `Reservations whose item text carries session ${searchParams.session}.`
              : "Every OAR reservation item, newest requirement date first, with the assistant session its item text (SGTXT) names — the link from a reservation back to the advice given for it."
          }
        />
        {live && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCard
              accent="primary"
              label="Total reservations"
              icon={<ListChecks className="size-3.5" aria-hidden />}
              value={formatCount(live.total ?? live.count)}
              hint="Every OAR reservation item that matches the filters."
            />
            <KpiCard
              accent="healthy"
              label="With an assistant session"
              icon={<MessagesSquare className="size-3.5" aria-hidden />}
              value={formatCount(live.linkedCount)}
              hint={`of the ${formatCount(live.count)} rows on this page carry a session ID in their item text.`}
            />
          </div>
        )}

        <ToolbarRow>
          <ViewToggle searchParams={searchParams} active="reservations" />
          <I13UrlFilters className="flex-1" fields={["plant", "material", "reservation"]} plants={live?.plantOptions} />
        </ToolbarRow>

        {live === null ? (
          <LoadFailure what="reservation ledger" message={loadError} />
        ) : (
          <>
            <ReservationLedgerTable rows={live.rows} />
            <TablePagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={live.total}
              count={live.count}
              noun="reservations"
              hrefFor={(p) => pageHref(PATH, searchParams, p)}
            />
          </>
        )}

        <DataSourcePanel />
    </OarScope>
  )
}

/**
 * Server-paged, newest first: 25 lines a page out of the whole OAR ledger
 * (~44k lines), with every filter -- plant, material and the three statuses --
 * applied by the backend. The header's numbers come from `/ledger/counts`, so
 * they describe every matching line rather than the lines on screen.
 */
async function ProcurementView({ searchParams }: { searchParams: I13SearchParams }) {
  const page = searchParams.page ?? 1
  // The try/catch wraps ONLY the fetch. Building JSX inside it would put the
  // render under the same handler as the request, so an error thrown while
  // rendering would be reported as a failed load -- the opposite of this page's
  // point about telling the two apart.
  let live: Awaited<ReturnType<typeof loadLiveLedger>> | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveLedger(
      {
        plant: searchParams.plant,
        material: searchParams.material,
        procurementStatus: searchParams.procurementStatus,
        utilisationStatus: searchParams.utilisationStatus,
        deliveryStatus: searchParams.deliveryStatus,
      },
      { page, pageSize: DEFAULT_PAGE_SIZE }
    )
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }
  // Past the end goes to the last page. Outside the try: redirect() throws.
  if (live?.total && page > pageCountOf(live.total, DEFAULT_PAGE_SIZE)) {
    redirect(pageHref(PATH, searchParams, pageCountOf(live.total, DEFAULT_PAGE_SIZE)))
  }

  const unmatched = live?.linkageCounts.UNMATCHED ?? 0
  const totalLines = live ? (live.total ?? live.count) : 0

  return (
    <OarScope>
        <OarPageHeader
          title="Utilization Ledger"
          subtitle="Every OAR procurement line, newest first, followed from reservation through goods issue."
        />

        {live && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCard
              accent="primary"
              label="Total procurement lines"
              icon={<Rows3 className="size-3.5" aria-hidden />}
              value={formatCount(totalLines)}
              hint={<LinkageBreakdown counts={live.linkageCounts} total={totalLines} />}
            />
            <KpiCard
              accent="caution"
              label="Unmatched lines"
              icon={<Unlink className="size-3.5" aria-hidden />}
              value={formatCount(unmatched)}
              hint={
                <>
                  <span className="font-semibold text-warning">{percentLabel(unmatched, totalLines)} of total</span> —
                  these could not be stitched together, so they are shown as unmatched rather than inferred.
                </>
              }
            />
          </div>
        )}

        <ToolbarRow>
          <ViewToggle searchParams={searchParams} active="lines" />
          <I13UrlFilters
            className="flex-1"
            fields={["plant", "material", "procurementStatus", "utilisationStatus", "deliveryStatus"]}
            plants={live?.plantOptions}
          />
        </ToolbarRow>

        {live === null ? (
          // Shown as a failure, never as an empty table. "No reservations" and
          // "cannot reach the server" must not look alike.
          <LoadFailure what="utilization ledger" message={loadError} />
        ) : (
          <>
            <UtilizationLedgerTable entries={live.rows} />
            <TablePagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={live.total}
              count={live.count}
              noun="ledger lines"
              hrefFor={(p) => pageHref(PATH, searchParams, p)}
            />
          </>
        )}

        <DataSourcePanel />
    </OarScope>
  )
}
