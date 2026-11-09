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
import { I08Page } from "@/features/initiative-8/components/kit/page"
import { OverviewFigures } from "@/features/initiative-8/components/overview-figures"
import { OverviewPrint } from "@/features/initiative-8/components/overview-print"
import { FILTER_LIST_CLASS } from "@/features/initiative-8/components/url-filters"
import { registerHref, type RegisterFilters } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { i08Date, i08DateTime } from "@/features/initiative-8/utils/format"
import {
  ALL,
  NO_OVERVIEW_FILTERS,
  filterOverview,
  overviewPdfTitle,
  summariseOverview,
  type OverviewFilters,
  type UniverseRow,
} from "@/features/initiative-8/utils/overview-view"
import { vendorLabel } from "@/features/initiative-8/utils/status"
import type { ApiUniverseMeta } from "@/lib/api/i8"
import { cn, formatCount } from "@/lib/utils"

/** What each filter narrows: behind the ⓘ beside Vendor, and in the PDF's header. */
const FILTER_NOTE =
  "Plant narrows every figure. Vendor and department narrow the repair figures only: " +
  "materials monitored and stock on hand have neither, so they stay as they are."

export type OverviewDashboardProps = {
  chains: RepairChain[]
  /** PRs raised for repair with no PO yet (PR rows): their card and their row
   *  of the waiting table, never a figure about repairs that are out. Empty
   *  when the backend serves none. */
  requests?: RepairChain[]
  agingBands: string[]
  /** Null when the universe fetch failed: its tile says so. */
  universe: { meta: ApiUniverseMeta; rows: UniverseRow[] } | null
  plantOptions: { plantId: string; name: string }[]
  vendorOptions: string[]
  /** The departments that raised the listed repairs (`departmentOptions`). */
  departmentOptions: { value: string; label: string }[]
  referenceDate: string
  /** "+3 PRs raised, no PO yet", or undefined when the backend does not serve
   *  them or has none. Never part of a figure about repairs that are out:
   *  `chains` holds PO lines only (see `withoutRepairRequests`). */
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
 * Plant narrows the register rows AND the universe rows, so every figure moves
 * together. Vendor and department (3-Nov-2026; it replaced criticality) narrow
 * the repairs only -- the universe has neither -- and the universe tile says so
 * when one is chosen; the full rule is behind the ⓘ beside the Vendor filter.
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
  plantOptions,
  vendorOptions,
  departmentOptions,
  referenceDate,
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
  // The PRs raised for repair with no PO yet, under the same filters.
  const requestSlice = useMemo(() => filterOverview(requests, [], filters).chains, [requests, filters])

  const activeFilters = Object.values(filters).filter((v) => v !== ALL).length
  const plantChoices = plantOptions.map((p) => ({ value: p.plantId, label: p.name }))
  const vendorChoices = vendorOptions.map((v) => ({ value: v, label: v }))

  // The register's filters for the same slice, so a link into the register
  // opens what the figure counted. The register filters a vendor by code, the
  // Overview by name; a department is a code on both.
  const linkFilters: RegisterFilters = {
    plant: filters.plant === ALL ? undefined : filters.plant,
    vendor:
      filters.vendor === ALL
        ? undefined
        : (chains.find((c) => vendorLabel(c) === filters.vendor)?.vendor ?? "none"),
    department: filters.department === ALL ? undefined : filters.department,
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
    requests: requestSlice,
    agingBands,
    metrics,
    universeLoaded: universe !== null,
    linkFilters,
    repairsOnlyFiltered: filters.vendor !== ALL || filters.department !== ALL,
  }
  const plants = new Set(chains.map((c) => c.plant.plantId)).size
  const caption = `Open repair lines for 80-series spares, as at ${i08Date(referenceDate)}.`

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
              title="Open the PRs raised for repair with no PO yet. They are counted apart from the open repair lines."
              className="text-i08-link hover:underline"
            >
              {repairRequestsNote}
            </Link>
          )}
          <InfoPopover title="What this page shows">
            <p>
              The repair POs SAP still has open for 80-series (repairable) materials. A line leaves when SAP
              marks it delivery completed.
            </p>
            <p>Every number opens the list behind it, filtered to the same plant, vendor and department.</p>
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
      {/* The dashboard filters by plant, vendor and department (3-Nov-2026: department replaced criticality,
          which the register still offers under "More filters"). */}
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
          value={filters.department}
          onChange={setFilter("department")}
          allLabel="All departments"
          options={departmentOptions}
          className="w-64"
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
          <p className="mt-1 text-[13.5px] text-muted-foreground">Try another plant, vendor or department.</p>
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
            department: labelOf(filters.department, departmentOptions, "All departments"),
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
        // The whole name on hover: the button keeps to one line.
        title={labelOf(value, options, allLabel)}
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
      <SelectContent className={FILTER_LIST_CLASS} alignItemWithTrigger={false} align="start">
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
