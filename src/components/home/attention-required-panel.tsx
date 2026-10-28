import Link from "next/link"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { AREA_FILL } from "@/components/home/home-areas"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { relativeDue } from "@/features/initiative-13/utils/oar-display"
import { formatWhen } from "@/lib/api/format"
import type { GlobalAction, InitiativeId } from "@/lib/domain/contracts"
import { cn, formatCount } from "@/lib/utils"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const SEVERITY_ICON = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleAlert,
} as const

/** The icon sits in a tinted circle in its severity's colour. */
const SEVERITY_CLASS = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/10 text-destructive",
} as const

const SEVERITY_LABEL = {
  info: "Information",
  warning: "Warning",
  critical: "Critical",
} as const

const INITIATIVE_LABEL: Record<GlobalAction["initiative"], string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

export type ActionFilter = "all" | InitiativeId | "approvals"
export type ActionSort = "urgent" | "newest"

const FILTERS: { value: ActionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "initiative-7", label: "Inventory" },
  { value: "initiative-8", label: "Repairable" },
  { value: "initiative-13", label: "OAR" },
  { value: "approvals", label: "Approvals" },
]

const SHOWN = 10

/**
 * `total` is the real number of open items, which can exceed the slice in
 * `actions`; when it does the footer says so rather than letting the list pass
 * for the whole picture.
 *
 * The filter and sort controls are optional: without handlers the panel is
 * the plain list it always was.
 */
export function AttentionRequiredPanel({
  actions,
  total,
  failedModules = 0,
  filter = "all",
  onFilterChange,
  sort = "urgent",
  onSortChange,
}: {
  actions: GlobalAction[]
  total?: number
  /** How many modules could not be loaded. An empty list is only "all clear" when this is 0. */
  failedModules?: number
  filter?: ActionFilter
  onFilterChange?: (filter: ActionFilter) => void
  sort?: ActionSort
  onSortChange?: (sort: ActionSort) => void
}) {
  const hidden = (total ?? actions.length) - Math.min(actions.length, SHOWN)
  return (
    <section aria-labelledby="priority-actions-heading" className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="priority-actions-heading" className="text-base font-semibold text-foreground">
            Priority actions
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">What needs a decision right now. Click through to act on it.</p>
        </div>
        {(onFilterChange || onSortChange) && (
          <div className="flex flex-wrap items-center gap-2">
            {onFilterChange && (
              <div role="group" aria-label="Show actions from" className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => onFilterChange(f.value)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      filter === f.value
                        ? "border-foreground bg-foreground text-card"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {onSortChange && (
              <label className="flex items-center">
                <span className="sr-only">Sort actions</span>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as ActionSort)}
                  className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <option value="urgent">Most urgent first</option>
                  <option value="newest">Newest first</option>
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {actions.length === 0 ? (
          failedModules > 0 ? (
            <EmptyState
              title="Nothing to show"
              description={`${failedModules} module${failedModules === 1 ? "" : "s"} could not be loaded, so this is not a statement that nothing needs attention.`}
            />
          ) : (
            <EmptyState title={filter === "all" ? "Nothing needs attention right now" : "Nothing here for this filter"} />
          )
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {actions.slice(0, SHOWN).map((action) => {
                const Icon = SEVERITY_ICON[action.severity]
                const due = action.dueAt ? relativeDue(action.dueAt) : null
                return (
                  <li key={action.id}>
                    <Link
                      href={action.href}
                      className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          SEVERITY_CLASS[action.severity]
                        )}
                      >
                        <Icon aria-hidden className="size-4" />
                        <span className="sr-only">{SEVERITY_LABEL[action.severity]}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{action.title}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden className={cn("size-1.5 rounded-full", AREA_FILL[action.initiative])} />
                          {INITIATIVE_LABEL[action.initiative]} · {formatWhen(action.createdAt)}
                        </div>
                      </div>
                      {due && (
                        <StatusPill tone={due.overdue ? "urgent" : "caution"} className="shrink-0">
                          {due.label}
                        </StatusPill>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {hidden > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                <span>
                  Showing <span className="font-semibold text-foreground">{Math.min(actions.length, SHOWN)}</span> of{" "}
                  <span className="font-semibold text-foreground">{formatCount(total ?? actions.length)}</span>
                </span>
                <Link
                  href="/actions"
                  className="inline-flex min-h-11 items-center font-semibold text-action hover:underline"
                >
                  View all actions
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
