"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OverviewFigures } from "@/features/initiative-8/components/overview-figures"
import { OverviewPrint } from "@/features/initiative-8/components/overview-print"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  filterOverview,
  openLinesByVendor,
  overviewPdfTitle,
  summariseOverview,
  type OverviewFilters,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"
import { NO_CRITICALITY } from "@/features/initiative-8/utils/status"
import { formatApiDateTime } from "@/lib/api/format"
import type { ApiUniverseMeta } from "@/lib/api/i8"
import { cn, formatCount } from "@/lib/utils"

/** What each filter narrows. Under the filters on screen, and in the PDF's header. */
const FILTER_NOTE =
  "Plant and criticality narrow every figure. Vendor narrows the repair-line figures only — " +
  "the repairable universe has no vendor. Pending declarations are counted over the whole " +
  "register and never narrow."

export type OverviewDashboardProps = {
  /** The page header's description, repeated at the top of the PDF. */
  description: string
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
 * One tile cannot be filtered at all: pending declarations come from a `meta`
 * the backend computes over everything. The strip under the filters says so,
 * and the PDF repeats the strip, rather than either silently narrowing.
 *
 * ## Download PDF
 *
 * The PDF is this page as filtered, printed by the browser: the same
 * `OverviewFigures` the screen draws, under a header naming the filters. See
 * `overview-print.tsx` for why it is a copy and not the page itself.
 *
 * Every line is open in SAP: since 19-Oct-2026 the register serves no line SAP
 * has marked "Delivery completed", so there is no vendor turnaround here either
 * -- it was dispatch to goods receipt over closed repairs.
 */
export function OverviewDashboard({
  description,
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
  // When Download PDF was clicked, for the PDF's header. Set from the click
  // until the print dialog closes, and the PDF copy is mounted only for that
  // long.
  const [printedAt, setPrintedAt] = useState<string | null>(null)
  const printing = printedAt !== null

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

  // Open the print dialog once the PDF copy is on the page. Waits for webfonts
  // (printing mid-swap reflows the text) and then two frames, so the copy has
  // been committed and laid out and its charts have measured themselves --
  // the same wait as the I07 report's Download PDF.
  //
  // The copy comes down on `afterprint`, which fires when the dialog closes,
  // saved or cancelled. While the dialog is open, the page's title is the
  // PDF's name: "Save as PDF" offers the title as the file name.
  useEffect(() => {
    if (!printing) return
    let cancelled = false
    const pageTitle = document.title
    const finish = () => setPrintedAt(null)
    window.addEventListener("afterprint", finish)

    document.fonts.ready
      .then(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }),
      )
      .then(() => {
        if (cancelled) return
        document.title = overviewPdfTitle(referenceDate)
        window.print()
      })

    return () => {
      cancelled = true
      window.removeEventListener("afterprint", finish)
      document.title = pageTitle
    }
  }, [printing, referenceDate])

  const figures = {
    chains: slice.chains,
    agingBands,
    metrics,
    vendors,
    universeLoaded: universe !== null,
    pendingDeclarations,
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPrintedAt(formatApiDateTime(new Date().toISOString()))}
              disabled={printing}
            >
              <Download className="size-3.5" />
              Download PDF
            </Button>
          </div>
        </FilterBar>
        <p
          className={cn(
            "text-[11px]",
            filters.vendor === ALL ? "text-muted-foreground" : "font-medium text-warning",
          )}
        >
          {FILTER_NOTE}
        </p>
      </div>

      <OverviewFigures {...figures} />

      {/* Only ever set by a click, so this never renders on the server. */}
      {printedAt !== null && (
        <OverviewPrint
          title="Repairable Spares — Overview"
          caption={description}
          filters={{
            plant: labelOf(filters.plant, plantChoices, "All plants"),
            vendor: labelOf(filters.vendor, vendorChoices, "All vendors"),
            criticality: labelOf(filters.criticality, criticalityChoices, "All criticalities"),
          }}
          lines={`${formatCount(metrics.totalLines)} of ${formatCount(chains.length)} repair lines`}
          note={FILTER_NOTE}
          printedAt={printedAt}
        >
          <OverviewFigures {...figures} print />
        </OverviewPrint>
      )}
    </>
  )
}

/** The label a filter value reads as, for the PDF's header. */
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
