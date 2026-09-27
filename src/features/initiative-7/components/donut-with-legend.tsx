"use client"

// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
//
// Generic donut+legend, extracted from RecommendationStatusChart's rendering
// pattern (see recommendation-status-chart.tsx) but with no hardcoded
// RecommendationStatus type -- the report's Recommendations-status and
// Demand-Classification sections each have their own label set (backend
// LifecycleStatus vs. SMOOTH/ERRATIC/INTERMITTENT/LUMPY/UNCLASSIFIED), so
// this takes a plain `{ label, count, color }[]` instead of force-fitting
// either section onto the recommendation-specific component.

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts"

import { cn, formatCount } from "@/lib/utils"

export interface DonutSlice {
  label: string
  count: number
  color: string
}

function SliceTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{point.value}</div>
      <div className="mt-0.5 text-muted-foreground">{point.name}</div>
    </div>
  )
}

/** Every slice is always listed in the legend, in the order given, even at a
 * count of zero -- consistent with RecommendationStatusChart's own rule that
 * a category legitimately absent right now still reads as a real business
 * view rather than being silently dropped. Only non-zero slices are plotted
 * in the pie itself (a 0-value wedge has no angle to render). */
export function DonutWithLegend({
  slices,
  activeLabel,
  onSliceClick,
}: {
  slices: DonutSlice[]
  activeLabel?: string | null
  onSliceClick?: (label: string) => void
}) {
  const pieData = slices.filter((s) => s.count > 0)

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="label"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              onClick={(entry) => {
                const label = (entry as { label?: string })?.label
                if (label) onSliceClick?.(label)
              }}
              cursor={onSliceClick ? "pointer" : undefined}
            >
              {pieData.map((d) => (
                <Cell
                  key={d.label}
                  fill={d.color}
                  opacity={activeLabel && activeLabel !== d.label ? 0.3 : 1}
                />
              ))}
            </Pie>
            <Tooltip content={SliceTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {slices.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => onSliceClick?.(d.label)}
            disabled={!onSliceClick}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-sm transition-colors",
              onSliceClick && "cursor-pointer hover:bg-muted/50",
              activeLabel && activeLabel !== d.label && "opacity-40"
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatCount(d.count)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
