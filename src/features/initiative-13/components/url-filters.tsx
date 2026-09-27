"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { FilterBar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { mergeSearchParams } from "@/features/initiative-13/utils/search-params"
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
  /** Bands present in the data. Falls back to the SOP three when empty. */
  agingBands?: string[]
  /** Plants present in the data — a list beats typing a code you have to know. */
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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FilterBar className="flex-1">
        {fields.includes("plant") &&
          (plants && plants.length > 0 ? (
            <UrlSelect
              label="All plants"
              width="sm:w-40"
              value={searchParams.get("plant") ?? ""}
              options={plants.map((p) => ({ value: p, label: `Plant ${p}` }))}
              onChange={(value) => push({ plant: value })}
            />
          ) : (
            <DebouncedInput
              placeholder="Plant (1300 or 1500)"
              value={searchParams.get("plant") ?? ""}
              onCommit={(value) => push({ plant: value })}
              className="sm:w-40"
            />
          ))}

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
            options={(agingBands?.length ? agingBands : ["FAST", "SLOW", "NON_MOVING"]).map(
              (band) => ({ value: band, label: AGING_LABEL[band] ?? band })
            )}
            onChange={(value) => push({ agingBand: value })}
          />
        )}

        {fields.includes("acquiredVsPlanStatus") && (
          <UrlSelect
            label="All plan statuses"
            width="sm:w-44"
            value={searchParams.get("acquiredVsPlanStatus") ?? ""}
            options={Object.entries(PLAN_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(value) => push({ acquiredVsPlanStatus: value })}
          />
        )}

        {fields.includes("type") && (
          <UrlSelect
            label="All exception types"
            width="sm:w-48"
            value={searchParams.get("type") ?? ""}
            options={(exceptionTypes?.length
              ? exceptionTypes
              : ["PLAN_BREACH", "NO_PLAN", "NO_PLAN_GRNI", "QUANTITY_OVERRIDE"]
            ).map((t) => ({ value: t, label: EXCEPTION_TYPE_LABEL[t] ?? t }))}
            onChange={(value) => push({ type: value })}
          />
        )}

        {fields.includes("status") && (
          <UrlSelect
            label="All statuses"
            width="sm:w-48"
            value={searchParams.get("status") ?? ""}
            options={(exceptionStatuses?.length
              ? exceptionStatuses
              : ["OPEN", "AWAITING_REQUESTER", "CONFIRMED", "ESCALATED", "RESOLVED"]
            ).map((s) => ({ value: s, label: EXCEPTION_STATUS_LABEL[s] ?? s }))}
            onChange={(value) => push({ status: value })}
          />
        )}
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

const AGING_LABEL: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

const PLAN_LABEL: Record<string, string> = {
  NO_PLAN: "No plan",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "Aligned",
  ABOVE_PLAN: "Above plan",
}

const EXCEPTION_TYPE_LABEL: Record<string, string> = {
  PLAN_BREACH: "Plan breach",
  NO_PLAN: "No plan",
  NO_PLAN_GRNI: "No plan + 30-day GRNI",
  QUANTITY_OVERRIDE: "Quantity override",
}

const EXCEPTION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open — not routed",
  AWAITING_REQUESTER: "Awaiting requester",
  CONFIRMED: "Confirmed",
  ESCALATED: "Escalated to HOD",
  RESOLVED: "Resolved",
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
    <Select
      value={value || ALL}
      onValueChange={(v) => {
        const next = v ?? ALL
        onChange(next === ALL ? "" : next)
      }}
    >
      <SelectTrigger className={cn("h-9 w-full", width)}>
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
    <Input
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      className={cn("h-9", className)}
    />
  )
}
