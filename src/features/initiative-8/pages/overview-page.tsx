import { connection } from "next/server"
import type { ReactNode } from "react"

import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { RepairAgingChart } from "@/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairStatusChart } from "@/features/initiative-8/components/repair-status-chart"
import { RepairsByVendorChart } from "@/features/initiative-8/components/repairs-by-vendor-chart"
import {
  loadLiveOverview,
  openLinesByVendor,
  quantityUnderRepair,
  unjustifiedAcquisitions,
  type LiveOverview,
} from "@/features/initiative-8/data/live-overview"
import { StageAgingChart } from "@/features/initiative-8/components/stage-aging-chart"
import { VendorTurnaroundTable } from "@/features/initiative-8/components/vendor-turnaround-table"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { formatApiDateTime } from "@/lib/api/format"
import { formatCount } from "@/lib/utils"

const DESCRIPTION =
  "Repair register, condition attestation and reservation-time compliance for 80-series spares."

/** Shown on a tile whose source could not be read — never a 0. */
const NOT_LOADED = "Could not be loaded"

/**
 * The Initiative 8 overview — live.
 *
 * Every tile and chart reads the backend: the register (counts from its meta,
 * charts from its rows), the repairable universe, and the declaration and
 * exception checks' meta. See `data/live-overview.ts` for which figure comes
 * from where. The eight hand-written fixture chains this page used to total up
 * are gone from it; nothing on screen is invented.
 *
 * The register is required; the other sources are best-effort, and a tile
 * whose source failed says so instead of showing a number.
 *
 * The exception check's result shows here as the Unjustified new purchases
 * tile and per line in the register. The Exception Queue screen it links to
 * came back on 12-Oct-2026, after the 09-Oct FRS audit found FR-8, FR-9,
 * FR-11 and acceptance criteria 5 and 11 had nothing rendering them.
 */
export async function RefurbishableSparesOverviewPage() {
  // Not statically prerendered: every figure here moves as attestations and
  // justifications are recorded.
  await connection()

  // The try/catch wraps ONLY the fetch -- see the note on the register page.
  let live: LiveOverview | null = null
  let loadError: string | null = null
  try {
    live = await loadLiveOverview()
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  if (live === null) {
    return (
      <Shell description={DESCRIPTION}>
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
        >
          <p className="font-medium text-foreground">The overview could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            The repair register did not answer, and every figure on this page
            depends on it. Check that the backend is running and that
            NEXT_PUBLIC_API_BASE_URL points at it.
          </p>
        </div>
      </Shell>
    )
  }

  const { register, universe, declarations, exceptions, vendorTurnaround } = live
  const meta = register.meta
  const vendors = openLinesByVendor(register.chains)
  const unjustified = exceptions ? unjustifiedAcquisitions(exceptions) : undefined
  const unknownStockRows = universe?.stockByPlant.unknownRows ?? 0

  return (
    <Shell
      description={
        // No source named here either -- see `registerDescription`. The page
        // knows when the figures are measured as of; it has no way to know
        // which SAP load produced them, and said "the July extract" for weeks
        // after that stopped being true.
        `${DESCRIPTION} As at ${register.referenceDate}.` +
        (register.sourceLoadedAt
          ? ` SAP data loaded ${formatApiDateTime(register.sourceLoadedAt)}.`
          : "")
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPIStatCard
          label="Repairable materials monitored"
          value={universe ? formatCount(universe.meta.totalMaterials) : UNKNOWN}
          hint={
            universe
              ? `80-series, across ${universe.meta.plants} plants`
              : NOT_LOADED
          }
        />
        <KPIStatCard
          label="Qty currently under repair"
          value={formatCount(quantityUnderRepair(register.chains))}
          hint="units on open repair lines"
        />
        <KPIStatCard
          label="Open repair lines"
          value={formatCount(meta.openLines)}
          hint={`of ${formatCount(meta.totalLines)} in the register`}
        />
        {/* UNJUSTIFIED_ACQUISITION: a new unit bought while a repair of the
            same part was open, with no justification on record. A dash, not
            a 0, when the backend does not run that check. */}
        <KPIStatCard
          label="Unjustified new purchases"
          value={unjustified === undefined ? UNKNOWN : formatCount(unjustified)}
          trend={unjustified ? "down" : "flat"}
          trendLabel={unjustified ? "Unjustified" : undefined}
          hint={
            !exceptions
              ? NOT_LOADED
              : unjustified === undefined
                ? "check not running on this backend yet"
                : "new units bought while a repair was open"
          }
        />
        <KPIStatCard
          label="Pending declarations"
          value={declarations ? formatCount(declarations.outstanding) : UNKNOWN}
          hint={declarations ? "Required + Flagged" : NOT_LOADED}
        />
        <KPIStatCard
          label="Repairs overdue"
          value={formatCount(meta.overdueLines)}
          trend={meta.overdueLines > 0 ? "down" : "flat"}
          trendLabel={meta.overdueLines > 0 ? "Past promised return" : undefined}
          hint={`${meta.overdueLines > 0 ? "· " : ""}${formatCount(meta.noDueDateLines)} with no due date`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          title="Repair status distribution"
          subtitle={`All ${formatCount(meta.totalLines)} repair lines, by current lifecycle stage`}
          span={6}
        >
          <RepairStatusChart chains={register.chains} />
        </ChartCard>
        <ChartCard
          title="Repairs by vendor"
          subtitle={
            vendors.vendorCount > vendors.top.length
              ? `Open repair lines — top ${vendors.top.length} of ${vendors.vendorCount} vendors`
              : "Open repair lines per vendor"
          }
          footnote={
            <>
              A count of open lines, not a turnaround.
              {vendors.otherLines > 0 &&
                ` The other ${vendors.vendorCount - vendors.top.length} vendors hold ${formatCount(vendors.otherLines)} open lines.`}{" "}
              Lines with no PO header in the extract are grouped as Unknown vendor.
            </>
          }
          span={6}
        >
          <RepairsByVendorChart data={vendors.top} />
        </ChartCard>
        {/* FR-10's vendor turnaround. Deliberately NEXT TO "Repairs by
            vendor", which counts open lines: the two look like the same
            question and are not, and putting them apart would let either be
            read as the other. */}
        <ChartCard
          title="Vendor turnaround"
          subtitle="Dispatch to goods receipt, over closed repairs only"
          footnote={
            <>
              Measured from the first 541 to the first goods receipt on the same
              line. A line still at a vendor has no turnaround yet and is
              counted under &ldquo;Repairs by vendor&rdquo; instead.
            </>
          }
          span={6}
        >
          {vendorTurnaround ? (
            <VendorTurnaroundTable vendors={vendorTurnaround} />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Vendor turnaround could not be loaded, so it is not shown. This is
              not &ldquo;no turnaround measured&rdquo;.
            </div>
          )}
        </ChartCard>
        {/* FR-9's "aging bands per lifecycle stage". Next to Repair aging,
            which buckets the whole-repair clock: the two look like the same
            question and are not, so they are shown together rather than one
            standing in for the other. */}
        <ChartCard
          title="Aging by stage"
          subtitle="Open repair lines, by days in their CURRENT stage"
          footnote={
            <>
              Days open runs from the PO line&rsquo;s creation date; this runs
              from the line entering the stage it is in now. A line 200 days
              open but 3 days at the vendor is a different problem from one 200
              days open and 190 at the vendor.
            </>
          }
          span={6}
        >
          <StageAgingChart chains={register.chains} bands={register.agingBands} />
        </ChartCard>
        <ChartCard
          title="Repair aging"
          subtitle={`Days open for the ${formatCount(meta.openLines)} open repair lines`}
          span={6}
        >
          <RepairAgingChart chains={register.chains} bands={register.agingBands} />
        </ChartCard>
        <ChartCard
          title="Repairable stock by plant"
          subtitle="Stock on hand across the repairable universe (every 80-series material and plant)"
          footnote={
            universe && unknownStockRows > 0
              ? `${formatCount(unknownStockRows)} material-plant rows have no stock record and add nothing to the bars.`
              : undefined
          }
          span={6}
        >
          {universe ? (
            <RepairableStockByPlantChart data={universe.stockByPlant.plants} />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              The repairable universe could not be loaded, so stock is not shown.
            </div>
          )}
        </ChartCard>
      </div>
    </Shell>
  )
}

function Shell({ description, children }: { description: string; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Repairable Spares" description={description} />
        {children}
      </div>
    </div>
  )
}
