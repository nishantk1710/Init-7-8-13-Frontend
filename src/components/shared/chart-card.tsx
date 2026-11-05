import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const SPAN_CLASSES = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
} as const

/**
 * Business-agnostic bordered section card with a title/subtitle/hint header
 * and an optional footnote — the shared container every module's
 * charts/tables sit inside.
 */
export function ChartCard({
  title,
  subtitle,
  hint,
  footnote,
  info,
  span = 12,
  size = "default",
  highlightSubtitle = false,
  className,
  children,
}: {
  title: string
  subtitle?: string
  hint?: string
  footnote?: ReactNode
  /** Sits in the top-right corner of the header -- the (i) icon that explains the chart. */
  info?: ReactNode
  span?: keyof typeof SPAN_CLASSES
  /** "large": a bigger title and subtitle, for a card that is mostly a table people read closely. */
  size?: "default" | "large"
  /** Draws the subtitle as a blue-edged callout, for a line the reader must not miss (what the card lists, and what it leaves out). */
  highlightSubtitle?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4",
        SPAN_CLASSES[span],
        className
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("font-medium text-foreground", size === "large" ? "text-lg" : "text-sm")}>{title}</div>
          {subtitle && (
            <div
              className={cn(
                "mt-0.5 text-muted-foreground",
                size === "large" ? "text-sm" : "text-xs",
                highlightSubtitle && "mt-1.5 w-fit rounded-sm border-l-4 border-action bg-action/10 px-2.5 py-1.5 font-semibold text-foreground"
              )}
            >
              {subtitle}
            </div>
          )}
          {hint && (
            <div className="mt-0.5 text-xs font-medium text-primary">{hint}</div>
          )}
        </div>
        {info}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {footnote && (
        <div className="mt-2.5 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground italic">
          {footnote}
        </div>
      )}
    </div>
  )
}
