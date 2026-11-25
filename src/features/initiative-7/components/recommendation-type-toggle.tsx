"use client"

import { cn } from "@/lib/utils"

/**
 * The Recommendations page's view switch: OAR to Min-Max | Min-Max to OAR | Stock item.
 *
 * Drawn exactly like the other bordered, shadowed segmented toggles in the app (a white box outlined in blue
 * marks the selected view), but as buttons: the page keeps its filters in state, not in the URL, so a choice
 * is not a link. The choice replaces the Recommendation dropdown the filter bar used to carry.
 */
export function RecommendationTypeToggle({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="max-w-full overflow-x-auto p-1 pb-3">
      <div
        role="tablist"
        aria-label="Recommendation type"
        className="inline-flex h-11 items-center gap-1 rounded-lg border-2 border-action/40 bg-card p-1 shadow-lg"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => !selected && onChange(option.value)}
              className={cn(
                "inline-flex h-full items-center justify-center rounded-md border border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-all duration-300 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected ? "border-action bg-background text-foreground shadow-md" : "cursor-pointer text-foreground/70 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
