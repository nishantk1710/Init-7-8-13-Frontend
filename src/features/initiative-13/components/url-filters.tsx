"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2, X } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { filterOptions, OAR_PLANTS } from "@/features/initiative-13/utils/filter-options"
import { mergeSearchParams } from "@/features/initiative-13/utils/search-params"
import {
  AGING_BAND_LABEL,
  AGING_BAND_ORDER,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_ORDER,
  EXCEPTION_TYPE_LABEL,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_ORDER,
} from "@/features/initiative-13/utils/status-labels"
import { cn } from "@/lib/utils"

const ALL = "all"
const DEBOUNCE_MS = 400

/**
 * The OAR screens' filter controls, writing to the URL instead of to state.
 *
 * The pages are server components now, so they read their filters from
 * `searchParams`. That makes these controls write-only: they push a new URL and
 * the server re-renders with the data for it. Nothing here holds the answer.
 *
 * ## The pending state is not decoration
 *
 * `router.replace` inside `useTransition` keeps the current rows on screen
 * while the next set is fetched, instead of blanking the table. Without the
 * transition every filter change would flash an empty screen; without the
 * spinner it would look frozen. Both halves are needed, which is why the
 * `isPending` flag is rendered rather than just tracked.
 *
 * ## Why the text inputs keep local state
 *
 * Typing is client work. A controlled input reading from `searchParams` would
 * re-render from the server on every keystroke and drop characters. So the text
 * fields hold their own value, debounce, and then write the URL — while the
 * selects, which change one whole value at a time, write immediately.
 */
export function I13UrlFilters({
  fields,
  agingBands,
  plants,
  exceptionTypes,
  exceptionStatuses,
  className,
}: {
  /** Which controls this screen wants. Not every screen filters by everything. */
  fields: readonly (
    | "plant"
    | "material"
    | "agingBand"
    | "acquiredVsPlanStatus"
    | "type"
    | "status"
  )[]
  /** Bands seen in the data. Added to the full list, never instead of it. */
  agingBands?: string[]
  /** Plants seen in the data. Added to the OAR plants, never instead of them:
   * the data is already filtered, so on its own it would list only the plant
   * currently selected. */
  plants?: string[]
  exceptionTypes?: string[]
  exceptionStatuses?: string[]
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function push(patch: Record<string, string | undefined>) {
    const query = mergeSearchParams(searchParams, patch)
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const activeCount = fields.filter((field) => searchParams.get(field)).length

  /** Only the parameters this bar owns — `?view=grni` and the like stay. */
  function clearAll() {
    push(Object.fromEntries(fields.map((field) => [field, undefined])))
  }

  const selectedPlant = searchParams.get("plant")

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FilterBar className="flex-1">
        {fields.includes("plant") && (
          <UrlSelect
            label="All plants"
            width="sm:w-40"
            value={selectedPlant ?? ""}
            options={filterOptions(OAR_PLANTS, plants, selectedPlant).map((p) => ({
              value: p,
              label: `Plant ${p}`,
            }))}
            onChange={(value) => push({ plant: value })}
          />
        )}

        {fields.includes("material") && (
          <DebouncedInput
            placeholder="Material"
            value={searchParams.get("material") ?? ""}
            onCommit={(value) => push({ material: value })}
            className="sm:w-44"
          />
        )}

        {fields.includes("agingBand") && (
          <UrlSelect
            label="All aging bands"
            width="sm:w-40"
            value={searchParams.get("agingBand") ?? ""}
            options={filterOptions(AGING_BAND_ORDER, agingBands, searchParams.get("agingBand")).map(
              (band) => ({ value: band, label: labelFor(AGING_BAND_LABEL, band) })
            )}
            onChange={(value) => push({ agingBand: value })}
          />
        )}

        {fields.includes("acquiredVsPlanStatus") && (
          <UrlSelect
            label="All plan statuses"
            width="sm:w-44"
            value={searchParams.get("acquiredVsPlanStatus") ?? ""}
            options={filterOptions(
              PLAN_STATUS_ORDER,
              [],
              searchParams.get("acquiredVsPlanStatus")
            ).map((value) => ({ value, label: labelFor(PLAN_STATUS_LABEL, value) }))}
            onChange={(value) => push({ acquiredVsPlanStatus: value })}
          />
        )}

        {fields.includes("type") && (
          <UrlSelect
            label="All exception types"
            width="sm:w-48"
            value={searchParams.get("type") ?? ""}
            options={filterOptions(
              Object.keys(EXCEPTION_TYPE_LABEL),
              exceptionTypes,
              searchParams.get("type")
            ).map((t) => ({ value: t, label: labelFor(EXCEPTION_TYPE_LABEL, t) }))}
            onChange={(value) => push({ type: value })}
          />
        )}

        {fields.includes("status") && (
          <UrlSelect
            label="All statuses"
            width="sm:w-48"
            value={searchParams.get("status") ?? ""}
            options={filterOptions(
              EXCEPTION_STATUS_ORDER,
              exceptionStatuses,
              searchParams.get("status")
            ).map((st) => ({ value: st, label: labelFor(EXCEPTION_STATUS_LABEL, st) }))}
            onChange={(value) => push({ status: value })}
          />
        )}

        <ClearFiltersButton activeCount={activeCount} onClear={clearAll} />
      </FilterBar>

      {/* Sized and reserved whether or not it is spinning, so the filter row
          does not jump every time somebody changes a value. */}
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
}

function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value
}

function UrlSelect({
  label,
  value,
  options,
  onChange,
  width,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  width: string
}) {
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]))
  return (
    <div className={cn("relative w-full", width)}>
      <Select
        value={value || ALL}
        onValueChange={(v) => {
          const next = v ?? ALL
          onChange(next === ALL ? "" : next)
        }}
      >
        <SelectTrigger className={cn("h-9 w-full", value && "pr-12")}>
          <SelectValue placeholder={label}>
            {(v: string) => (v === ALL ? label : labels[v] ?? v)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{label}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* A sibling of the trigger, not inside it: a button nested in the
          trigger's button would open the list instead of clearing. */}
      {value && (
        <ClearOne label={labels[value] ?? value} onClear={() => onChange("")} className="right-7" />
      )}
    </div>
  )
}

function ClearOne({
  label,
  onClear,
  className,
}: {
  label: string
  onClear: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear filter: ${label}`}
      title="Clear this filter"
      className={cn(
        "absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <X className="size-3.5" />
    </button>
  )
}

/**
 * A text filter that writes the URL once typing settles.
 *
 * Re-syncs from the prop when the URL changes underneath it — a back button, or
 * another control clearing everything — but never while the user is mid-word,
 * which is what the `document.activeElement` check is for.
 */
function DebouncedInput({
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

  // Re-sync when the URL-side value changes underneath us — a back button, or
  // another control clearing everything.
  //
  // Adjusted during render rather than in an effect. This is React's own
  // pattern for "a prop changed and some state should reset with it": setting
  // state while rendering re-runs this component immediately, before anything
  // is painted and before any child renders, so there is no flash of the stale
  // draft and no cascading render. An effect would paint the old value first,
  // and lint rejects it for exactly that reason.
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
        placeholder={placeholder}
        aria-label={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={cn("h-9 w-full", draft && "pr-8")}
      />
      {draft && (
        <ClearOne
          label={draft}
          onClear={() => {
            setDraft("")
            onCommit("")
          }}
          className="right-2"
        />
      )}
    </div>
  )
}
