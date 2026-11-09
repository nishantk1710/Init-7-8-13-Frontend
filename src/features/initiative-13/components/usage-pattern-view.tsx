"use client"

import { useSyncExternalStore } from "react"
import { LayoutGrid, Rows3 } from "lucide-react"

import { UsagePatternCards } from "@/features/initiative-13/components/usage-pattern-cards"
import { UsagePatternTable } from "@/features/initiative-13/components/usage-pattern-table"
import type { UsagePattern } from "@/lib/api/i13"
import { cn } from "@/lib/utils"

type Layout = "cards" | "table"
const STORAGE_KEY = "i13-usage-layout"

// The remembered layout, read as an external store: the server renders cards,
// the browser then shows what this viewer last picked, with no effect needed.
const listeners = new Set<() => void>()
function readLayout(): Layout {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "cards"
  } catch {
    return "cards"
  }
}
function writeLayout(next: Layout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage blocked: the choice still applies until the page reloads.
    fallback = next
  }
  listeners.forEach((l) => l())
}
let fallback: Layout | null = null
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The Usage Pattern tab's body: a cards/table switch and
 * the rows in whichever layout. The choice is remembered in this browser only;
 * both layouts show the same page of rows.
 */
export function UsagePatternView({ rows }: { rows: UsagePattern[] }) {
  const layout = useSyncExternalStore(subscribe, () => fallback ?? readLayout(), () => "cards" as Layout)
  const choose = writeLayout

  const layoutSwitch = (
    <div role="group" aria-label="Layout" className="flex gap-0.5 rounded-lg border border-border bg-card p-1">
      {(
        [
          ["cards", LayoutGrid, "Cards"],
          ["table", Rows3, "Table"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={layout === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-md transition-colors",
            layout === value ? "bg-action/10 text-action" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  )

  // Cards carry the switch on their heading row; the table has its own row for it.
  return layout === "cards" ? (
    <UsagePatternCards rows={rows} layoutSwitch={layoutSwitch} />
  ) : (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">{layoutSwitch}</div>
      <UsagePatternTable rows={rows} />
    </div>
  )
}
