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
  span = 12,
  className,
  children,
}: {
  title: string
  subtitle?: string
  hint?: string
  footnote?: ReactNode
  span?: keyof typeof SPAN_CLASSES
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
      <div className="mb-2.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        )}
        {hint && (
          <div className="mt-0.5 text-xs font-medium text-primary">{hint}</div>
        )}
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
