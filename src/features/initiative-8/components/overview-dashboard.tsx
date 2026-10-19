"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RepairAgingChart } from "@/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairsByVendorChart } from "@/features/initiative-8/components/repairs-by-vendor-chart"
import { RepairStatusChart } from "@/features/initiative-8/components/repair-status-chart"
import { StageAgingChart } from "@/features/initiative-8/components/stage-aging-chart"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  OVERVIEW_SUMMARY_HEADERS,
  filterOverview,
  openLinesByVendor,
  overviewSummaryRows,
  summariseOverview,
  type OverviewFilters,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"
import { NO_CRITICALITY, UNKNOWN } from "@/features/initiative-8/utils/status"
import type { ApiUniverseMeta } from "@/lib/api/i8"
import { cn, downloadExcel, formatCount } from "@/lib/utils"

export type OverviewDashboardProps = {
  chains: RepairChain[]
  agingBands: string[]
  /** Null when the universe fetch failed: its tiles show a dash, its chart says so. */
  universe: { meta: ApiUniverseMeta; rows: UniverseRow[] } | null
  /** Outstanding declarations over the whole register. Not filterable. */
  pendingDeclarations?: number
  plantOptions: { plantId: string; name: string }[]
  vendorOptions: string[]
  criticalityOptions: string[]
  referenceDate: string
}

/**
 * The Initiative 8 dashboard (FR-10), live.
 *
 * A client component so the filters can work without a round trip: the page
 * fetches every register and universe row on the server and hands them over,
 * which is the same split the register table has always used.
 *
 * ## What the filters narrow
 *
 * Plant and criticality narrow the register rows AND the universe rows, so
 * every tile and chart moves together. Vendor narrows the repair lines only —
 * the universe has no vendor, and emptying it to zero under a vendor filter
 * would answer a question the data cannot answer. The strip under the filters
 * says so on screen rather than leaving someone to infer it.
 *
 * Two tiles cannot be filtered at all: pending declarations and unjustified
 * new purchases come from a `meta` the backend computes over everything. The
 * strip under the filters and the export say so rather than silently narrowing.
 *
 * Every line is open in SAP: since 19-Oct-2026 the register serves no line SAP
 * has marked "Delivery completed", so there is no vendor turnaround here either
 * -- it was dispatch to goods receipt over closed repairs.
 */
export function OverviewDashboard({
  chains,
  agingBands,
  universe,
  pendingDeclarations,
  plantOptions,
  vendorOptions,
  criticalityOptions,
  referenceDate,
}: OverviewDashboardProps) {
  const [filters, setFilters] = useState<OverviewFilters>(NO_OVERVIEW_FILTERS)

  const slice = useMemo(
    () => filterOverview(chains, universe?.rows ?? [], filters),
    [chains, universe, filters],
  )
  const metrics = useMemo(() => summariseOverview(slice), [slice])
  const vendors = useMemo(() => openLinesByVendor(slice.chains), [slice])

  const activeFilters = Object.values(filters).filter((v) => v !== ALL).length
  const plantChoices = plantOptions.map((p) => ({ value: p.plantId, label: p.name }))
  const vendorChoices = vendorOptions.map((v) => ({ value: v, label: v }))
  const criticalityChoices = criticalityOptions.map((c) => ({
    value: c,
    label: c === NO_CRITICALITY ? "No criticality" : c,
  }))

  function setFilter(key: keyof OverviewFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  function exportSummary() {
    downloadExcel(
      "i08-overview-summary.xlsx",
      OVERVIEW_SUMMARY_HEADERS,
      overviewSummaryRows(
        metrics,
        {
          plant: labelOf(filters.plant, plantChoices, "All plants"),
          vendor: labelOf(filters.vendor, vendorChoices, "All vendors"),
          criticality: labelOf(filters.criticality, criticalityChoices, "All criticalities"),
        },
        {
          referenceDate,
          pendingDeclarations,
        },
      ),
    )
  }

  return (
    <>
      {/* FR-10: the dashboard filters by plant, vendor and criticality. */}
      <div className="flex flex-col gap-1.5">
        <FilterBar>
          <FilterSelect
            value={filters.plant}
            onChange={setFilter("plant")}
            allLabel="All plants"
            options={plantChoices}
            className="sm:w-48"
          />
          <FilterSelect
            value={filters.vendor}
            onChange={setFilter("vendor")}
            allLabel="All vendors"
            options={vendorChoices}
            className="sm:w-56"
          />
          <FilterSelect
            value={filters.criticality}
            onChange={setFilter("criticality")}
            allLabel="All criticalities"
            options={criticalityChoices}
            className="sm:w-44"
          />
          <ClearFiltersButton
            activeCount={activeFilters}
            onClear={() => setFilters(NO_OVERVIEW_FILTERS)}
          />
          <div className="flex items-center gap-3 sm:ml-auto">
            <span className="text-xs text-muted-foreground">
              {formatCount(metrics.totalLines)} of {formatCount(chains.length)} lines
            </span>
            <Button size="sm" variant="outline" onClick={exportSummary}>
              <Download className="size-3.5" />
              Export summary
            </Button>
          </div>
        </FilterBar>
        <p
          className={cn(
            "text-[11px]",
            filters.vendor === ALL ? "text-muted-foreground" : "font-medium text-warning",
          )}
        >
          Plant and criticality narrow every figure. Vendor narrows the repair-line figures
          only — the repairable universe has no vendor. Pending declarations are counted over
          the whole register and never narrow.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPIStatCard
          label="Repairable materials monitored"
          value={universe ? formatCount(metrics.universeMaterials) : UNKNOWN}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          title="Repair status distribution"
          subtitle={`The ${formatCount(metrics.totalLines)} open repair lines, by current lifecycle stage`}
          span={6}
        >
          <RepairStatusChart chains={slice.chains} />
        </ChartCard>
        <ChartCard
          title="Repairs by vendor"
          subtitle={
            vendors.vendorCount > vendors.top.length
              ? `Open repair lines — top ${vendors.top.length} of ${vendors.vendorCount} vendors`
              : "Open repair lines per vendor"
          }
          span={6}
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
        >
          <StageAgingChart chains={slice.chains} bands={agingBands} />
        </ChartCard>
        <ChartCard
          title="Repair aging"
          subtitle={`Days open for the ${formatCount(metrics.openLines)} open repair lines`}
          span={6}
        >
          <RepairAgingChart chains={slice.chains} bands={agingBands} />
        </ChartCard>
        <ChartCard
          title="Repairable stock by plant"
          subtitle="Stock on hand across the repairable universe (every 80-series material and plant)"
          span={12}
        >
          {universe ? (
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

/** The label a filter value reads as, for the CSV's header rows. */
function labelOf(
  value: string,
  options: { value: string; label: string }[],
  allLabel: string,
): string {
  return value === ALL ? allLabel : options.find((o) => o.value === value)?.label ?? value
}

/** One dashboard dropdown: an "all" choice followed by the given options. */
function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={allLabel}>
          {(selected: string) =>
            selected === ALL
              ? allLabel
              : options.find((o) => o.value === selected)?.label ?? selected
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
