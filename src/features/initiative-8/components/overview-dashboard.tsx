"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InfoPopover } from "@/features/initiative-8/components/kit/info-popover"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { OverviewFigures } from "@/features/initiative-8/components/overview-figures"
import { OverviewPrint } from "@/features/initiative-8/components/overview-print"
import { registerHref, type RegisterFilters } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { i08Date, i08DateTime } from "@/features/initiative-8/utils/format"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  filterOverview,
  openExceptionCounts,
  overviewPdfTitle,
  summariseOverview,
  type OpenExceptionItem,
  type OverviewFilters,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"
import { NO_CRITICALITY, vendorLabel } from "@/features/initiative-8/utils/status"
import type { ApiUniverseMeta } from "@/lib/api/i8"
import { cn, formatCount } from "@/lib/utils"

/** What each filter narrows: behind the ⓘ beside Vendor, and in the PDF's header. */
const FILTER_NOTE =
  "Plant and criticality narrow every figure. Vendor narrows the repair-line figures only. " +
  "Materials monitored and stock on hand have no vendor, so they stay as they are."

export type OverviewDashboardProps = {
  chains: RepairChain[]
  /** Repairs requested with no PO yet (PR rows): counted on their own, never
   *  in a figure about repairs that are out. Empty on an older backend. */
  requests?: RepairChain[]
  agingBands: string[]
  /** Null when the universe fetch failed: its tile says so. */
  universe: { meta: ApiUniverseMeta; rows: UniverseRow[] } | null
  /** Every open exception item, by the line it is on; null when the queue
   *  could not be read. */
  exceptions: OpenExceptionItem[] | null
  plantOptions: { plantId: string; name: string }[]
  vendorOptions: string[]
  criticalityOptions: string[]
  referenceDate: string
  sourceLoadedAt: string | null
  /** "+3 repairs requested, no PO yet", or undefined when the backend does not
   *  serve them or has none. Never part of any figure: `chains` holds PO lines
   *  only (see `withoutRepairRequests`). */
  repairRequestsNote?: string
}

/**
 * The Initiative 8 Overview (FR-10), Live -- I08_Live_UI_Redesign_Plan.md, L1.
 *
 * A client component so the filters work without a round trip: the page
 * fetches every register and universe row on the server and hands them over.
 *
 * ## What the filters narrow
 *
 * Plant and criticality narrow the register rows AND the universe rows, so
 * every figure moves together. Vendor narrows the repair lines only -- the
 * universe has no vendor -- and the universe tile says so when one is chosen;
 * the full rule is behind the ⓘ beside the Vendor filter. "Not declared" is now
 * counted from the lines, so it narrows with them like everything else.
 *
 * ## Download PDF
 *
 * The PDF is this page as filtered, printed by the browser: the same
 * `OverviewFigures` the screen draws, under a header naming the filters. See
 * `overview-print.tsx` for why it is a copy and not the page itself.
 */
export function OverviewDashboard({
  chains,
  requests = [],
  agingBands,
  universe,
  exceptions,
  plantOptions,
  vendorOptions,
  criticalityOptions,
  referenceDate,
  sourceLoadedAt,
  repairRequestsNote,
}: OverviewDashboardProps) {
  const [filters, setFilters] = useState<OverviewFilters>(NO_OVERVIEW_FILTERS)
  const [printedAt, setPrintedAt] = useState<string | null>(null)
  const printing = printedAt !== null

  const slice = useMemo(
    () => filterOverview(chains, universe?.rows ?? [], filters),
    [chains, universe, filters],
  )
  const metrics = useMemo(() => summariseOverview(slice), [slice])
  // The repairs requested with no PO yet, under the same filters.
  const requestSlice = useMemo(() => filterOverview(requests, [], filters).chains, [requests, filters])
  const exceptionCounts = useMemo(() => {
    if (exceptions === null) return null
    const known = new Set([...chains, ...requests].map((c) => c.id))
    return openExceptionCounts([...slice.chains, ...requestSlice], known, exceptions, filters)
  }, [chains, requests, slice, requestSlice, exceptions, filters])

  const activeFilters = Object.values(filters).filter((v) => v !== ALL).length
  const plantChoices = plantOptions.map((p) => ({ value: p.plantId, label: p.name }))
  const vendorChoices = vendorOptions.map((v) => ({ value: v, label: v }))
  const criticalityChoices = criticalityOptions.map((c) => ({
    value: c,
    label: c === NO_CRITICALITY ? "Not rated" : c.charAt(0) + c.slice(1).toLowerCase(),
  }))

  // The register's filters for the same slice, so a link into the register
  // opens what the figure counted. The register filters a vendor by code, the
  // Overview by name. The declaration and exception queues cannot narrow by all
  // of it: their cards say so (`queueNote`).
  const linkFilters: RegisterFilters = {
    plant: filters.plant === ALL ? undefined : filters.plant,
    vendor:
      filters.vendor === ALL
        ? undefined
        : (chains.find((c) => vendorLabel(c) === filters.vendor)?.vendor ?? "none"),
    criticality:
      filters.criticality === ALL
        ? undefined
        : filters.criticality === NO_CRITICALITY
          ? "none"
          : filters.criticality,
  }

  function setFilter(key: keyof OverviewFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  // Download PDF: mount the print copy, wait for it to lay out, then print. The
  // copy comes down on `afterprint`, so a cancelled dialog leaves nothing behind.
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
    // Shown only when the backend serves PR rows: a count it never made is
    // not zero.
    repairRequests: repairRequestsNote ? requestSlice.length : undefined,
    agingBands,
    metrics,
    universeLoaded: universe !== null,
    exceptions: exceptionCounts,
    linkFilters,
    vendorFiltered: filters.vendor !== ALL,
  }
  const plants = new Set(chains.map((c) => c.plant.plantId)).size
  const loaded = sourceLoadedAt ? `SAP data loaded ${i08DateTime(sourceLoadedAt)}` : null
  const caption =
    `Open repair lines for 80-series spares, as at ${i08Date(referenceDate)}.` + (loaded ? ` ${loaded}.` : "")

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares" }]}
      title="Overview"
      summary={
        <>
          <span>
            {formatCount(chains.length)} open repair lines at {plants} {plants === 1 ? "plant" : "plants"}
          </span>
          {repairRequestsNote && (
            // Not narrowed by the filters below: the backend counts them over
            // the whole register, and the register lists them.
            <Link
              href={registerHref({ view: "notOrdered" })}
              title="Open the repairs requested on a purchase requisition with no PO yet. They are counted apart from the open repair lines."
              className="text-i08-link hover:underline"
            >
              {repairRequestsNote}
            </Link>
          )}
          {loaded && (
            <>
              <Dot />
              <span>{loaded}</span>
            </>
          )}
          <InfoPopover title="What this page shows">
            <p>
              The repair POs SAP still has open for 80-series (repairable) materials. A line leaves when SAP
              marks it delivery completed.
            </p>
            <p>Every number opens the list behind it, filtered to the same plant, vendor and criticality.</p>
          </InfoPopover>
        </>
      }
      actions={
        <Button
          size="lg"
          variant="outline"
          className="px-3.5 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
          onClick={() => setPrintedAt(i08DateTime(new Date().toISOString()))}
          disabled={printing}
        >
          <Printer className="size-4" />
          Download PDF
        </Button>
      }
    >
      {/* FR-10: the dashboard filters by plant, vendor and criticality. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <FilterSelect
          value={filters.plant}
          onChange={setFilter("plant")}
          allLabel="All plants"
          options={plantChoices}
          className="w-48"
        />
        <span className="inline-flex items-center gap-0.5">
          <FilterSelect
            value={filters.vendor}
            onChange={setFilter("vendor")}
            allLabel="All vendors"
            options={vendorChoices}
            className="w-60"
          />
          <InfoPopover title="What the filters narrow">
            <p>{FILTER_NOTE}</p>
          </InfoPopover>
        </span>
        <FilterSelect
          value={filters.criticality}
          onChange={setFilter("criticality")}
          allLabel="All criticalities"
          options={criticalityChoices}
          className="w-44"
        />
        {activeFilters > 0 && (
          <>
            <button
              type="button"
              onClick={() => setFilters(NO_OVERVIEW_FILTERS)}
              className="rounded-sm px-1.5 text-[13.5px] font-medium text-i08-link hover:underline"
            >
              Clear filters
            </button>
            <span className="ml-auto text-[13px] text-muted-foreground">
              {formatCount(slice.chains.length)} of {formatCount(chains.length)} repair lines
            </span>
          </>
        )}
      </div>

      {slice.chains.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-[15px] font-semibold text-foreground">No repair lines match these filters</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Try another plant, vendor or criticality.</p>
        </div>
      ) : (
        <OverviewFigures {...figures} />
      )}

      {/* Only ever set by a click, so this never renders on the server. */}
      {printedAt !== null && (
        <OverviewPrint
          title="Repairable Spares — Overview"
          caption={caption}
          filters={{
            plant: labelOf(filters.plant, plantChoices, "All plants"),
            vendor: labelOf(filters.vendor, vendorChoices, "All vendors"),
            criticality: labelOf(filters.criticality, criticalityChoices, "All criticalities"),
          }}
          lines={`${formatCount(slice.chains.length)} of ${formatCount(chains.length)} repair lines`}
          note={FILTER_NOTE}
          printedAt={printedAt}
        >
          <OverviewFigures {...figures} print />
        </OverviewPrint>
      )}
    </I08Page>
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

/**
 * One dashboard dropdown: an "all" choice followed by the given options. A set
 * filter is tinted, so a narrowed Overview is never mistaken for the whole.
 */
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
  const set = value !== ALL
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger
        aria-label={allLabel}
        className={cn(
          "h-9 bg-background",
          set && "border-primary/60 bg-accent font-medium text-accent-foreground",
          className,
        )}
      >
        <SelectValue placeholder={allLabel}>
          {(selected: string) =>
            selected === ALL
              ? allLabel
              : options.find((o) => o.value === selected)?.label ?? selected
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="i08-scope">
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
