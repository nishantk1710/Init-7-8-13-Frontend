"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Download } from "lucide-react"

import { ChartCard } from "@demo/components/shared/chart-card"
import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { PageHeader } from "@demo/components/shared/page-header"
import { Button } from "@demo/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import { RepairAgingChart } from "@demo/features/initiative-8/components/repair-aging-chart"
import { RepairStatusChart } from "@demo/features/initiative-8/components/repair-status-chart"
import { RepairableStockByPlantChart } from "@demo/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairsByVendorChart } from "@demo/features/initiative-8/components/repairs-by-vendor-chart"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"
import { StageAgingChart } from "@demo/features/initiative-8/components/stage-aging-chart"
import {
  VendorTurnaroundChart,
  vendorTurnaround,
} from "@demo/features/initiative-8/components/vendor-turnaround-chart"
import {
  ASSISTANT_CUTOVER,
  ATTESTATION_CUTOVER,
  I8_PLANTS,
  OVERDUE_GRACE_DAYS,
  REFERENCE_DATE,
} from "@demo/features/initiative-8/data/config"
import { CRITICALITY_OPTIONS, REPAIR_VENDORS } from "@demo/features/initiative-8/data/repair-chains"
import {
  ALL,
  NO_FILTERS,
  filterSnapshot,
  isOpenLine,
  summarise,
  type I8Filters,
  type I8Metrics,
  type Ratio,
} from "@demo/features/initiative-8/model/metrics"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import { cn, downloadCsv, formatCount } from "@demo/lib/utils"

const DESCRIPTION =
  "Repair register, condition attestation and reservation-time compliance for 80-series spares."

const PLANT_OPTIONS = I8_PLANTS.map((p) => ({ value: p.plantId, label: p.name }))
const VENDOR_OPTIONS = REPAIR_VENDORS.map((v) => ({ value: v, label: v }))
const CRITICALITY_FILTER_OPTIONS = CRITICALITY_OPTIONS.map((c) => ({ value: c, label: c }))

/** Open repair lines per vendor — a count, not a turnaround. */
function openLinesByVendor(chains: RepairChain[], limit = 10) {
  const byVendor = new Map<string, number>()
  for (const chain of chains) {
    if (!isOpenLine(chain)) continue
    byVendor.set(chain.vendor, (byVendor.get(chain.vendor) ?? 0) + 1)
  }
  const ranked = [...byVendor]
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor))
  return {
    top: ranked.slice(0, limit),
    vendorCount: ranked.length,
    otherLines: ranked.slice(limit).reduce((sum, v) => sum + v.count, 0),
  }
}

function filterLabel(value: string, options: { value: string; label: string }[], all: string) {
  return value === ALL ? all : options.find((o) => o.value === value)?.label ?? value
}

/**
 * The figures on the page as a two-column CSV, with the filters that produced
 * them on top — a summary pasted into a report must say which slice it is.
 */
function summaryRows(m: I8Metrics, filters: I8Filters): (string | number)[][] {
  const ratioRows = (name: string, r: Ratio): (string | number)[][] => [
    [`${name} (%)`, r.percent ?? ""],
    [`${name} (compliant)`, r.count],
    [`${name} (measured)`, r.total],
  ]
  return [
    ["As at", REFERENCE_DATE],
    ["Plant filter", filterLabel(filters.plant, PLANT_OPTIONS, "All plants")],
    ["Vendor filter (repair lines only)", filterLabel(filters.vendor, VENDOR_OPTIONS, "All vendors")],
    ["Criticality filter", filterLabel(filters.criticality, CRITICALITY_FILTER_OPTIONS, "All criticalities")],
    ["Repairable materials monitored", m.universeMaterials],
    ["Material-plant rows in the universe", m.universeRows],
    ["Qty currently under repair", m.qtyUnderRepair],
    ["Open repair lines", m.openLines],
    ["Repair lines in the register", m.totalLines],
    ["Unjustified purchases open", m.openByType.UNJUSTIFIED_ACQUISITION],
    ["Pending declarations (Required + Flagged)", m.pendingDeclarations],
    [`Repairs overdue (after the ${OVERDUE_GRACE_DAYS}-day grace)`, m.overdueLines],
    ["Open repairs with no due date", m.noDueDateLines],
    ...ratioRows(`Declaration compliance (lines since ${ATTESTATION_CUTOVER})`, m.declarationCompliance),
    ...ratioRows(`Session compliance (reservations since ${ASSISTANT_CUTOVER})`, m.sessionCompliance),
    ...ratioRows("Justification compliance", m.justificationCompliance),
    ["Purchases avoided (ZAR)", m.avoided.value],
    ["Sessions that chose repair", m.avoided.sessions],
    ["Units not bought new", m.avoided.units],
    ["Average vendor turnaround (days)", m.averageTurnaround ?? ""],
    ["Open exceptions", m.openExceptions],
    ["Open exceptions: overdue repair", m.openByType.OVERDUE_REPAIR],
    ["Open exceptions: missing attestation", m.openByType.MISSING_ATTESTATION],
    ["Open exceptions: missing session ID", m.openByType.MISSING_SESSION_ID],
    ["Open exceptions: unjustified acquisition", m.openByType.UNJUSTIFIED_ACQUISITION],
  ]
}

/**
 * The Initiative 8 Overview, in the Snapshot: the FR-10 dashboard.
 *
 * Every figure on it — tiles, compliance rates, strips and charts — comes
 * from one `filterSnapshot` → `summarise` pass over the
 * session's snapshot, so a plant, vendor or criticality filter moves all of
 * them together, and a declaration or justification recorded on another
 * screen shows here the moment it is saved.
 *
 * Vendor is the odd filter out: only repair lines (and the exceptions raised
 * on them) have a vendor. The universe, reservations, purchases and sessions
 * do not, so the vendor filter leaves those figures alone and the page says so
 * rather than pretending otherwise.
 */
export function RefurbishableSparesOverviewPage() {
  const snapshot = useI08Snapshot()
  const [filters, setFilters] = useState<I8Filters>(NO_FILTERS)

  const slice = useMemo(() => filterSnapshot(snapshot, filters), [snapshot, filters])
  const metrics = useMemo(() => summarise(slice), [slice])
  const vendors = useMemo(() => openLinesByVendor(slice.lines), [slice])
  const turnaround = useMemo(() => vendorTurnaround(slice.lines), [slice])

  const turnaroundLines = turnaround.reduce((sum, v) => sum + v.lines, 0)
  const activeFilters = Object.values(filters).filter((v) => v !== ALL).length
  const unjustified = metrics.openByType.UNJUSTIFIED_ACQUISITION

  function setFilter(key: keyof I8Filters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  function exportSummary() {
    downloadCsv("i08-overview-summary.csv", ["Metric", "Value"], summaryRows(metrics, filters))
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <PageHeader
            title="Repairable Spares"
            description={`${DESCRIPTION} As at ${REFERENCE_DATE}.`}
          />
          <SessionChangesBanner snapshot={snapshot} />

          {/* FR-10: the dashboard filters by plant, vendor and criticality. */}
          <div className="flex flex-col gap-1.5">
            <FilterBar>
              <FilterSelect
                value={filters.plant}
                onChange={setFilter("plant")}
                allLabel="All plants"
                options={PLANT_OPTIONS}
                className="sm:w-48"
              />
              <FilterSelect
                value={filters.vendor}
                onChange={setFilter("vendor")}
                allLabel="All vendors"
                options={VENDOR_OPTIONS}
                className="sm:w-56"
              />
              <FilterSelect
                value={filters.criticality}
                onChange={setFilter("criticality")}
                allLabel="All criticalities"
                options={CRITICALITY_FILTER_OPTIONS}
                className="sm:w-44"
              />
              <ClearFiltersButton activeCount={activeFilters} onClear={() => setFilters(NO_FILTERS)} />
              <Button size="sm" variant="outline" onClick={exportSummary} className="sm:ml-auto">
                <Download className="size-3.5" />
                Export summary
              </Button>
            </FilterBar>
            <p
              className={cn(
                "text-[11px]",
                filters.vendor === ALL ? "text-muted-foreground" : "font-medium text-warning",
              )}
            >
              Plant and criticality narrow every figure. Vendor narrows the repair-line figures
              only — the universe, reservations, purchases and sessions have no vendor.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPIStatCard
            label="Repairable materials monitored"
            value={formatCount(metrics.universeMaterials)}
            hint={`80-series · ${formatCount(metrics.universeRows)} material-plant rows`}
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
          <KPIStatCard
            label="Unjustified purchases open"
            value={formatCount(unjustified)}
            trend={unjustified > 0 ? "down" : "flat"}
            trendLabel={unjustified > 0 ? "Unjustified" : undefined}
            hint="new units bought while a repairable one existed"
          />
          <KPIStatCard
            label="Pending declarations"
            value={formatCount(metrics.pendingDeclarations)}
            hint="Required + Flagged"
          />
          <KPIStatCard
            label="Repairs overdue"
            value={formatCount(metrics.overdueLines)}
            trend={metrics.overdueLines > 0 ? "down" : "flat"}
            trendLabel={metrics.overdueLines > 0 ? "Past promised return" : undefined}
            hint={`after the ${OVERDUE_GRACE_DAYS}-day grace · ${formatCount(metrics.noDueDateLines)} with no due date`}
          />
        </div>

        <Section
          title="Repairs"
          description="Where the repair lines stand, how long they have been out, and how quickly each vendor sends them back."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartCard
              title="Repair status distribution"
              subtitle={`All ${formatCount(metrics.totalLines)} repair lines, by repair status`}
              span={6}
            >
              <RepairStatusChart chains={slice.lines} />
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
                  A count of open lines; the turnaround is the next chart.
                  {vendors.otherLines > 0 &&
                    ` The other ${vendors.vendorCount - vendors.top.length} vendors hold ${formatCount(vendors.otherLines)} open lines.`}
                </>
              }
              span={6}
            >
              <RepairsByVendorChart data={vendors.top} />
            </ChartCard>
            <ChartCard
              title="Vendor turnaround"
              subtitle={
                turnaroundLines > 0
                  ? `Average days per vendor, slowest first — ${formatCount(turnaroundLines)} ${turnaroundLines === 1 ? "line" : "lines"}, ${metrics.averageTurnaround} days overall`
                  : "Average days per vendor"
              }
              footnote="Dispatch (MSEG 541) to first goods receipt, lines fully back only."
              span={6}
            >
              <VendorTurnaroundChart data={turnaround} />
            </ChartCard>
            <ChartCard
              title="Aging by stage"
              subtitle={`The ${formatCount(metrics.openLines)} open repair lines, by current stage and days in it`}
              footnote="Days since the line entered the stage it is in now — not days open overall."
              span={6}
            >
              <StageAgingChart chains={slice.lines} />
            </ChartCard>
            <ChartCard
              title="Repair aging"
              subtitle={`Days open for the ${formatCount(metrics.openLines)} open repair lines`}
              span={6}
            >
              <RepairAgingChart chains={slice.lines} />
            </ChartCard>
            <ChartCard
              title="Repairable stock by plant"
              subtitle={`Stock on hand across the repairable universe — ${formatCount(slice.universe.length)} material-plant rows`}
              footnote="Rows with no MARD record are left out of the sum: their stock is unknown, not zero."
              span={6}
            >
              <RepairableStockByPlantChart rows={slice.universe} />
            </ChartCard>
          </div>
        </Section>
      </div>
    </div>
  )
}

/** A small h2 with a one-line description, then the section's content. */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** One Overview dropdown: an "all" choice followed by the given options. */
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
          {(selected: string) => filterLabel(selected, options, allLabel)}
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
