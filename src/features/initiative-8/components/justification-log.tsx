"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, Loader2, X } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  fetchAllJustifications,
  JUSTIFICATIONS_PATH,
  justificationsHref,
  type JustificationFacets,
  type JustificationFilters,
} from "@/features/initiative-8/data/live-justifications"
import { isPlaceholderActor } from "@/lib/api/actor"
import type { ApiJustification } from "@/lib/api/assistant"
import { formatApiDateTime } from "@/lib/api/format"
import { kindLabel } from "@/lib/assistant/justifications"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, downloadExcel, formatCount } from "@/lib/utils"

const ALL = "all"
const DEBOUNCE_MS = 400
const EXPORT_FILENAME = "i08-new-acquisition-justifications.xlsx"

/**
 * I08's justification log -- one server page at a time.
 *
 * Its own component rather than the shared one I13 renders. I13's log merges
 * two sources in the browser (the assistant's table and ACT confirmations),
 * so it cannot page on the server; this one reads one table and does. The
 * card is the same, without the "captured" tag: every entry here comes from
 * the assistant at the reservation, so the tag said the same thing on every
 * card.
 *
 * The filters write the URL and the server re-renders with the page for it --
 * the I13 OAR screens' pattern (`url-filters.tsx`). A filtered log is a link
 * somebody can send, and back and forward work.
 *
 * An audit view only: nothing is changed from here.
 */
export function I08JustificationLog({
  items,
  total,
  overall,
  page,
  pageSize,
  filters,
  facets,
}: {
  items: ApiJustification[]
  /** Matching the filters. */
  total: number
  /** Every I08 justification on record. */
  overall: number
  page: number
  pageSize: number
  filters: JustificationFilters
  facets: JustificationFacets
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  /** Any filter change starts over at page 1: page 4 of the old filter means
   *  nothing in the new one. */
  function push(patch: JustificationFilters) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete("page")
    const query = next.toString()
    startTransition(() => {
      router.replace(query ? `${JUSTIFICATIONS_PATH}?${query}` : JUSTIFICATIONS_PATH, {
        scroll: false,
      })
    })
  }

  const activeFilters = [filters.q, filters.plant, filters.reason].filter(Boolean).length
  const filtered = activeFilters > 0

  /** Every match, not the page on screen -- see `fetchAllJustifications`. */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = await fetchAllJustifications(filters)
      const built = await downloadExcel(
        EXPORT_FILENAME,
        [
          "Kind",
          "Material",
          "Plant",
          "Reason category",
          "Free text",
          "Author",
          "Recorded at",
          "Session",
          "Exception",
        ],
        rows.map((entry) => [
          entry.kind,
          entry.materialId,
          entry.plant,
          entry.reasonCategory,
          entry.freeText,
          entry.author,
          entry.recordedAt,
          entry.sessionId ?? "",
          entry.exceptionId ?? "",
        ])
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  const filterBar = (
    <div className="flex items-center gap-2">
      <FilterBar className="flex-1">
        <SearchInput
          value={filters.q ?? ""}
          onCommit={(value) => push({ q: value })}
          placeholder="Search material, reason, author or text"
          className="sm:w-72"
        />
        <LogSelect
          value={filters.plant ?? ""}
          onChange={(value) => push({ plant: value })}
          allLabel="All plants"
          options={withSelected(facets.plants, filters.plant).map((p) => ({
            value: p,
            label: sapPlantLabel(p),
          }))}
          className="sm:w-52"
        />
        <LogSelect
          value={filters.reason ?? ""}
          onChange={(value) => push({ reason: value })}
          allLabel="All reasons"
          options={withSelected(facets.reasonCategories, filters.reason).map((r) => ({
            value: r,
            label: r.replace(/_/g, " "),
          }))}
          className="sm:w-56"
        />
        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => push({ q: undefined, plant: undefined, reason: undefined })}
        />
      </FilterBar>
      {/* Reserved whether or not it spins, so the row does not jump. */}
      <span className="flex size-4 shrink-0 items-center justify-center">
        {isPending && (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-label="Loading filtered results"
          />
        )}
      </span>
    </div>
  )

  if (total === 0) {
    return (
      <div className="flex flex-col gap-3">
        {filterBar}
        <EmptyState
          title={
            overall === 0
              ? "No new-unit justifications recorded yet."
              : "No justifications match these filters."
          }
          description={
            overall === 0
              ? "Nobody has yet chosen to buy a new unit while a repairable one exists. When someone does, the Spares Assistant asks them why at the reservation, and their reason appears here."
              : `All ${formatCount(overall)} recorded justifications were filtered out. Clear the filters to see them.`
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filterBar}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(total)}
          {filtered ? ` of ${formatCount(overall)}` : ""} justification(s)
        </p>
        <div className="flex items-center gap-2">
          {exportError && (
            <span role="alert" className="text-[11px] text-destructive">
              Export failed: {exportError}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => void exportExcel()} disabled={exporting}>
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      <div className={cn("flex flex-col gap-2", isPending && "opacity-60")}>
        {items.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">{entry.materialId}</span>
              <span className="text-muted-foreground">@ {sapPlantLabel(entry.plant)}</span>
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {kindLabel(entry.kind)}
              </span>
              {/* The house format (`en-ZA`, "12 Oct 2026, 14:42"), not the
                  viewer's browser locale -- see the shared log. */}
              <span className="ml-auto text-muted-foreground">
                {formatApiDateTime(entry.recordedAt)}
              </span>
            </div>

            <p className="mt-1.5 text-xs font-medium text-foreground">
              {entry.reasonCategory.replace(/_/g, " ")}
            </p>
            {/* The part a person actually reads when this is reviewed. */}
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.freeText}</p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Recorded by{" "}
              <span className={cn(isPlaceholderActor(entry.author) && "italic")}>
                {entry.author}
              </span>
              {isPlaceholderActor(entry.author) && " (no sign-in — provisional)"}
              {entry.sessionId && ` · session ${entry.sessionId}`}
              {entry.exceptionId && ` · exception ${entry.exceptionId}`}
            </p>
          </div>
        ))}
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={items.length}
        noun="justifications"
        hrefFor={(p) => justificationsHref(filters, p)}
      />
    </div>
  )
}

/** The values the server says exist, plus the one selected -- so a link to a
 *  value that no longer appears still shows what it is filtering by. */
function withSelected(values: readonly string[], selected?: string): string[] {
  return selected && !values.includes(selected) ? [...values, selected] : [...values]
}

function LogSelect({
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
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]))
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => {
        const next = v ?? ALL
        onChange(next === ALL ? "" : next)
      }}
    >
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={allLabel}>
          {(selected: string) => (selected === ALL ? allLabel : labels[selected] ?? selected)}
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

/**
 * The search box. It writes the URL once typing settles, not per keystroke:
 * a controlled input reading the URL would re-render from the server on every
 * key and drop characters. Same mechanics as I13's `DebouncedInput`.
 */
function SearchInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)

  // Re-sync when the URL changes underneath -- the back button, or Clear.
  // Adjusted during render, React's pattern for state that resets with a prop.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onCommit(draft.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label="Search justifications"
        className={cn("h-9 w-full", draft && "pr-8")}
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("")
            onCommit("")
          }}
          aria-label="Clear search"
          title="Clear search"
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
