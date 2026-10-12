"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardPagination } from "@/features/initiative-13/components/dashboard-pagination"
import { usePaginatedRows } from "@/features/initiative-13/hooks/use-paginated-rows"
import { isPlaceholderActor } from "@/lib/api/actor"
import {
  kindLabel,
  sourceLabel,
  type UnifiedJustification,
} from "@/lib/assistant/justifications"
import { downloadCsv, formatCount } from "@/lib/utils"
import { cn } from "@/lib/utils"

/** The "no filter" value every dropdown here uses. */
const ALL = "all"

/**
 * Justification Log — every reason recorded for going ahead anyway, from both
 * places they are captured.
 *
 * **This used to show half the record.** It read only ACT exception
 * confirmations, which are written after the fact when somebody chases an
 * exception. The reasons captured at the moment of the decision — the
 * `NEW_ACQUISITION` and `QUANTITY_OVERRIDE` records that I08 FR-7 and I13
 * FR-3 ask for by name — live in the shared `justification` table and were
 * invisible on the screen built to display them.
 *
 * The two sources are disjoint (only the assistant writes the shared table),
 * so they concatenate. Each row says which it is, because "explained before
 * the reservation was made" and "explained weeks later when chased" are
 * different kinds of evidence about the same person's reasoning, and a log
 * that flattens them invites a reader to treat the second as the first.
 *
 * An audit view only: nothing is changed from here.
 */
export function JustificationLog({
  entries,
  csvFilename = "i13-justifications.csv",
  filterable = false,
}: {
  entries: UnifiedJustification[]
  /** The export's filename. Initiative 08's justification page renders this
   *  log too, and a file of I08 records should not be named for I13. */
  csvFilename?: string
  /**
   * Show the search and the plant/reason/captured dropdowns.
   *
   * Opt-in rather than always on. I13 renders this log underneath its own
   * dashboard filters, which already narrow the entries handed in; a second
   * set of filters inside the component would be two controls for one job,
   * disagreeing with each other. I08's page has no such filters above it, and
   * a log nobody can search is one somebody pages through.
   */
  filterable?: boolean
}) {
  const [search, setSearch] = useState("")
  const [plant, setPlant] = useState<string>(ALL)
  const [reason, setReason] = useState<string>(ALL)
  const [source, setSource] = useState<string>(ALL)

  // Built from the entries, never hard-coded: the reason vocabulary is
  // configuration the backend serves and VZI will change it.
  const plants = useMemo(
    () => [...new Set(entries.map((e) => e.plant).filter(Boolean))].sort(),
    [entries],
  )
  const reasons = useMemo(
    () => [...new Set(entries.map((e) => e.reasonCategory).filter(Boolean))].sort(),
    [entries],
  )

  const filtered = useMemo(() => {
    if (!filterable) return entries
    const needle = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (plant !== ALL && entry.plant !== plant) return false
      if (reason !== ALL && entry.reasonCategory !== reason) return false
      if (source !== ALL && entry.source !== source) return false
      if (
        needle &&
        ![entry.material, entry.freeText, entry.author, entry.sessionId, entry.reasonCategory]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [entries, filterable, search, plant, reason, source])

  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } =
    usePaginatedRows(filtered)

  const activeFilters = [plant !== ALL, reason !== ALL, source !== ALL, search.trim() !== ""].filter(
    Boolean,
  ).length

  function exportCsv() {
    downloadCsv(
      csvFilename,
      [
        "Captured",
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
      filtered.map((entry) => [
        sourceLabel(entry.source),
        entry.kind,
        entry.material,
        entry.plant,
        entry.reasonCategory,
        entry.freeText,
        entry.author,
        entry.recordedAt,
        entry.sessionId ?? "",
        entry.exceptionId ?? "",
      ])
    )
  }

  /** The filter row, when the host screen asked for one. */
  const filterBar = filterable ? (
    <FilterBar>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search material, reason, author or text"
        aria-label="Search justifications"
        className="h-9 w-full sm:w-72"
      />
      <LogSelect
        value={plant}
        onChange={setPlant}
        allLabel="All plants"
        options={plants.map((p) => ({ value: p, label: p }))}
        className="sm:w-40"
      />
      <LogSelect
        value={reason}
        onChange={setReason}
        allLabel="All reasons"
        options={reasons.map((r) => ({ value: r, label: r.replace(/_/g, " ") }))}
        className="sm:w-56"
      />
      {/* When it was captured. "Explained before the reservation was made" and
          "explained weeks later when chased" are different kinds of evidence,
          and this is how a reader asks for one of them. */}
      <LogSelect
        value={source}
        onChange={setSource}
        allLabel="Captured any time"
        options={[
          { value: "ASSISTANT", label: sourceLabel("ASSISTANT") },
          { value: "EXCEPTION_QUEUE", label: sourceLabel("EXCEPTION_QUEUE") },
        ]}
        className="sm:w-56"
      />
      <ClearFiltersButton
        activeCount={activeFilters}
        onClear={() => {
          setSearch("")
          setPlant(ALL)
          setReason(ALL)
          setSource(ALL)
        }}
      />
    </FilterBar>
  ) : null

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {filterBar}
        <EmptyState
          title={
            entries.length === 0
              ? "No justifications recorded for the selected filters."
              : "No justifications match these filters."
          }
          description={
            entries.length === 0
              ? "Nobody has yet gone ahead against the assistant's advice, or confirmed a plan-breach or no-plan exception, for this plant and material."
              : `All ${formatCount(entries.length)} recorded justifications were filtered out. Clear the filters to see them.`
          }
        />
      </div>
    )
  }

  const fromAssistant = filtered.filter((e) => e.source === "ASSISTANT").length

  return (
    <div className="flex flex-col gap-3">
      {filterBar}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(filtered.length)}
          {filtered.length === entries.length
            ? ""
            : ` of ${formatCount(entries.length)}`}{" "}
          justification(s) · {fromAssistant} at reservation time,{" "}
          {filtered.length - fromAssistant} chasing an exception
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {paged.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">
                {entry.material}
              </span>
              <span className="text-muted-foreground">@ {entry.plant}</span>
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {kindLabel(entry.kind)}
              </span>
              {/* Which moment this was captured in. See the note above. */}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px]",
                  entry.source === "ASSISTANT"
                    ? "bg-secondary text-secondary-foreground"
                    : "border border-border text-muted-foreground"
                )}
              >
                {sourceLabel(entry.source)}
              </span>
              <span className="ml-auto text-muted-foreground">
                {new Date(entry.recordedAt).toLocaleString()}
              </span>
            </div>

            <p className="mt-1.5 text-xs font-medium text-foreground">
              {entry.reasonCategory.replace(/_/g, " ")}
            </p>
            {/* The part a person actually reads when this is reviewed. A
                category on its own records that a box was ticked. */}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.freeText}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Recorded by{" "}
              <span
                className={cn(
                  isPlaceholderActor(entry.author) && "italic"
                )}
              >
                {entry.author}
              </span>
              {isPlaceholderActor(entry.author) && " (no sign-in — provisional)"}
              {entry.sessionId && ` · session ${entry.sessionId}`}
              {entry.exceptionId && ` · exception ${entry.exceptionId}`}
            </p>
          </div>
        ))}
      </div>

      <DashboardPagination
        page={page}
        pageCount={pageCount}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={previous}
        onNext={next}
      />
    </div>
  )
}

/** One log dropdown: an "all" choice followed by the given options. */
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
