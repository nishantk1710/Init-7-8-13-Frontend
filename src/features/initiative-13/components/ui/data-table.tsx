import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The frame every OAR table sits in: a white card that scrolls sideways on its
 * own, so a wide table never pushes the page past the screen. Header styling
 * (12px uppercase bold) comes from `.oar-scope` in globals.css, which reaches
 * every table on these screens, framed here or not.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-full overflow-x-auto rounded-card border border-line bg-card [&_[data-slot=table-head]]:h-11 [&_[data-slot=table-head]]:px-3 [&_[data-slot=table-cell]:not(.p-0)]:px-3 [&_[data-slot=table-cell]:not(.p-0)]:py-3",
        className
      )}
    >
      {children}
    </div>
  )
}

/** The button that opens a table row's detail. Real, focusable, and named. */
export function RowToggle({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean
  onToggle: () => void
  /** What the row is, e.g. "ledger line PO 4501/10". */
  label: string
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Hide" : "Show"} details for ${label}`}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-primary-tint hover:text-primary-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChevronRight
        aria-hidden
        className={cn("size-4 transition-transform duration-300 ease-out", expanded && "rotate-90")}
      />
    </button>
  )
}
