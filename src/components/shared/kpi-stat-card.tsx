import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Trend = "up" | "down" | "flat"

const TREND_CLASSES: Record<Trend, string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
}

/**
 * Generic KPI tile — label, big value, optional trend/hint line. Used across
 * every initiative overview page instead of each one hand-rolling its own.
 */
export function KPIStatCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  icon,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  trend?: Trend
  trendLabel?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {(hint || trendLabel) && (
        <div className="flex items-center gap-1 text-xs">
          {trendLabel && (
            <span className={cn("font-medium", trend && TREND_CLASSES[trend])}>
              {trendLabel}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  )
}
