"use client"

import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { RepairAgingChart } from "@/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairsByVendorChart } from "@/features/initiative-8/components/repairs-by-vendor-chart"
import { RepairStatusChart } from "@/features/initiative-8/components/repair-status-chart"
import { StageAgingChart } from "@/features/initiative-8/components/stage-aging-chart"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { OverviewMetrics, VendorLines } from "@/features/initiative-8/utils/overview-view"
import { UNKNOWN } from "@/features/initiative-8/utils/status"
import { cn, formatCount } from "@/lib/utils"

/**
 * The overview's tiles and charts: what the screen shows and what the PDF
 * prints.
 *
 * One component for both, so the PDF is the page rather than a description of
 * it -- there is no second copy of the figures to drift from the first.
 *
 * `print` changes the grid and nothing else. The screen's grid follows the
 * browser window through the `sm:` and `lg:` breakpoints; the PDF is A4
 * landscape whatever size the window is, and its charts measure themselves
 * before the print dialog opens. So the print grid is fixed: five tiles in a
 * row and two charts a row, the arrangement the screen has at full width.
 */
export function OverviewFigures({
  chains,
  agingBands,
  metrics,
  vendors,
  universeLoaded,
  pendingDeclarations,
  print = false,
}: {
  /** The filtered repair lines. */
  chains: RepairChain[]
  agingBands: string[]
  metrics: OverviewMetrics
  vendors: VendorLines
  /** False when the universe fetch failed: its tile shows a dash, its chart says so. */
  universeLoaded: boolean
  pendingDeclarations?: number
  print?: boolean
}) {
  // `span` sets the screen's `lg:` column; in print the same span is set
  // unconditionally, so a narrow window cannot stack the PDF one chart a row.
  const half = print ? "col-span-6" : undefined
  const full = print ? "col-span-12" : undefined

  return (
    <>
      <div
        className={cn(
          "grid gap-3",
          print ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        )}
      >
        <KPIStatCard
          label="Repairable materials monitored"
          value={universeLoaded ? formatCount(metrics.universeMaterials) : UNKNOWN}
        />
        <KPIStatCard
          label="Qty currently under repair"
          value={formatCount(metrics.qtyUnderRepair)}
        />
        <KPIStatCard label="Open repair lines" value={formatCount(metrics.openLines)} />
        {/* No "Unjustified new purchases" tile since 14-Oct-2026. The reason
            for a new purchase is asked for at the reservation (FR-5b), and
            the count of purchases that carry one is reported on the
            Justifications screen, next to the reasons themselves. */}
        <KPIStatCard
          label="Pending declarations"
          value={pendingDeclarations === undefined ? UNKNOWN : formatCount(pendingDeclarations)}
        />
        <KPIStatCard label="Repairs overdue" value={formatCount(metrics.overdueLines)} />
      </div>

      <div className={cn("grid gap-4", print ? "grid-cols-12" : "grid-cols-1 lg:grid-cols-12")}>
        <ChartCard
          title="Repair status distribution"
          subtitle={`The ${formatCount(metrics.totalLines)} open repair lines, by current lifecycle stage`}
          span={6}
          className={half}
        >
          <RepairStatusChart chains={chains} />
        </ChartCard>
        <ChartCard
          title="Repairs by vendor"
          subtitle={
            vendors.vendorCount > vendors.top.length
              ? `Open repair lines — top ${vendors.top.length} of ${vendors.vendorCount} vendors`
              : "Open repair lines per vendor"
          }
          span={6}
          className={half}
        >
          <RepairsByVendorChart data={vendors.top} />
        </ChartCard>
        {/* FR-9's "aging bands per lifecycle stage". Next to Repair aging,
            which buckets the whole-repair clock: the two look like the same
            question and are not, so they are shown together rather than one
            standing in for the other. */}
        <ChartCard
          title="Aging by stage"
          subtitle="Open repair lines, by days in their CURRENT stage"
          span={6}
          className={half}
        >
          <StageAgingChart chains={chains} bands={agingBands} />
        </ChartCard>
        <ChartCard
          title="Repair aging"
          subtitle={`Days open for the ${formatCount(metrics.openLines)} open repair lines`}
          span={6}
          className={half}
        >
          <RepairAgingChart chains={chains} bands={agingBands} />
        </ChartCard>
        <ChartCard
          title="Repairable stock by plant"
          subtitle="Stock on hand across the repairable universe (every 80-series material and plant)"
          span={12}
          className={full}
        >
          {universeLoaded ? (
            <RepairableStockByPlantChart data={metrics.stock.plants} />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              The repairable universe could not be loaded, so stock is not shown.
            </div>
          )}
        </ChartCard>
      </div>
    </>
  )
}
