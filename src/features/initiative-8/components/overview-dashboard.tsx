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
import { VendorTurnaroundChart } from "@/features/initiative-8/components/vendor-turnaround-chart"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  OVERVIEW_SUMMARY_HEADERS,
  filterOverview,
  openLinesByVendor,
  overviewSummaryRows,
  summariseOverview,
  turnaroundBars,
  type OverviewFilters,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"
import { NO_CRITICALITY, UNKNOWN, UNKNOWN_VENDOR } from "@/features/initiative-8/utils/status"
import type { ApiUniverseMeta, ApiVendorTurnaround } from "@/lib/api/i8"
import { cn, downloadCsv, formatCount } from "@/lib/utils"

/** Shown on a tile whose source could not be read — never a 0. */
const NOT_LOADED = "Could not be loaded"

export type OverviewDashboardProps = {
  chains: RepairChain[]
  agingBands: string[]
  /** Null when the universe fetch failed: its tiles and chart say so. */
  universe: { meta: ApiUniverseMeta; rows: UniverseRow[] } | null
  /** Outstanding declarations over the whole register. Not filterable. */
  pendingDeclarations?: number
  /**
   * Unjustified acquisitions over the whole register. `undefined` means the
   * backend does not run that check; null means the fetch failed. The two show
   * differently, and neither shows as 0.
   */
  unjustifiedAcquisitions?: number
  exceptionsLoaded: boolean
  vendorTurnaround: ApiVendorTurnaround[] | null
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
 * new purchases come from a `meta` the backend computes over everything. They
 * are labelled on the tile and in the export rather than silently narrowing.
 */
export function OverviewDashboard({
  chains,
  agingBands,
  universe,
  pendingDeclarations,
  unjustifiedAcquisitions,
  exceptionsLoaded,
  vendorTurnaround,
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
  // Computed from the same helper the chart draws with, so the footnote's
  // "N of M" can never disagree with the bars above it.
  const turnaround = useMemo(
    () => (vendorTurnaround ? turnaroundBars(vendorTurnaround) : null),
    [vendorTurnaround],
  )

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
    downloadCsv(
      "i08-overview-summary.csv",
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
          unjustifiedAcquisitions,
        },
      ),
    )
  }

  const unknownStockRows = metrics.stock.unknownRows

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
          only — the repairable universe has no vendor. Pending declarations and unjustified
          new purchases are counted over the whole register and never narrow.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPIStatCard
          label="Repairable materials monitored"
          value={universe ? formatCount(metrics.universeMaterials) : UNKNOWN}
          hint={
            universe
              ? `80-series · ${formatCount(metrics.universeRows)} material-plant rows across ${formatCount(metrics.universePlants)} plants`
              : NOT_LOADED
          }
        />
        <KPIStatCard
          label="Qty currently under repair"
          value={formatCount(metrics.qtyUnderRepair)}
          hint="units on open repair lines"
        />
        <KPIStatCard
          label="Open repair lines"
          value={formatCount(metrics.openLines)}
          hint={`of ${formatCount(metrics.totalLines)} in the register`}
        />
        {/* UNJUSTIFIED_ACQUISITION: a new unit bought while a repair of the
            same part was open, with no justification on record. A dash, not
            a 0, when the backend does not run that check. */}
        <KPIStatCard
          label="Unjustified new purchases"
          value={
            unjustifiedAcquisitions === undefined
              ? UNKNOWN
              : formatCount(unjustifiedAcquisitions)
          }
          trend={unjustifiedAcquisitions ? "down" : "flat"}
          trendLabel={unjustifiedAcquisitions ? "Unjustified" : undefined}
          hint={
            !exceptionsLoaded
              ? NOT_LOADED
              : unjustifiedAcquisitions === undefined
                ? "check not running on this backend yet"
                : "new units bought while a repair was open · whole register"
          }
        />
        <KPIStatCard
          label="Pending declarations"
          value={pendingDeclarations === undefined ? UNKNOWN : formatCount(pendingDeclarations)}
          hint={pendingDeclarations === undefined ? NOT_LOADED : "Required + Flagged · whole register"}
        />
        <KPIStatCard
          label="Repairs overdue"
          value={formatCount(metrics.overdueLines)}
          trend={metrics.overdueLines > 0 ? "down" : "flat"}
          trendLabel={metrics.overdueLines > 0 ? "Past promised return" : undefined}
          hint={`${formatCount(metrics.noDueDateLines)} with no due date`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          title="Repair status distribution"
          subtitle={`All ${formatCount(metrics.totalLines)} repair lines, by current lifecycle stage`}
          footnote={
            <>
              Received and Closed are counted together: both mean the unit is
              back, and the only thing separating them is SAP&rsquo;s
              delivery-complete flag, which is set on about nine lines in ten
              whether or not anything has been received. The register&rsquo;s
              Repair Status column still tells them apart. There is no
              requisition stage — the register is built from purchase order
              lines, so a repair appears once it has been ordered.
            </>
          }
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
          footnote={
            <>
              A count of open lines, not a turnaround.
              {vendors.otherLines > 0 &&
                ` The other ${vendors.vendorCount - vendors.top.length} vendors hold ${formatCount(vendors.otherLines)} open lines.`}
              {/* Only said when it is true of the data on screen. Every line
                  currently carries a PO header, so the group is empty and a
                  standing sentence about it described a case that no longer
                  occurs. */}
              {vendors.top.some((v) => v.vendor === UNKNOWN_VENDOR) &&
                " Lines with no purchase-order header are grouped as Unknown vendor."}
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
          subtitle={
            turnaround && turnaround.bars.length > 0
              ? `Average days, dispatch to goods receipt — slowest ${turnaround.bars.length} of ${turnaround.measurable} measurable vendors`
              : "Dispatch to goods receipt, over closed repairs only"
          }
          footnote={
            <>
              Measured from the first 541 to the first goods receipt on the same
              line.{" "}
              {turnaround && (
                <>
                  <strong>
                    {turnaround.measurable} of {turnaround.total} vendors
                  </strong>{" "}
                  have at least one repair with both a dispatch and a receipt;
                  the rest hold repairs that cannot be timed yet and are not
                  drawn — that is not the same as having no repairs.{" "}
                </>
              )}
              A line still at a vendor has no turnaround yet and is counted
              under &ldquo;Repairs by vendor&rdquo; instead. Computed by the
              backend over the whole register, so the filters above do not
              narrow it.
            </>
          }
          span={6}
        >
          {vendorTurnaround ? (
            <VendorTurnaroundChart vendors={vendorTurnaround} />
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
          footnote={
            universe && unknownStockRows > 0
              ? `${formatCount(unknownStockRows)} material-plant rows have no stock record and add nothing to the bars.`
              : undefined
          }
          span={6}
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
