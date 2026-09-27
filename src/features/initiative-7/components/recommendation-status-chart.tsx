"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts"

import { cn, formatCount } from "@/lib/utils"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation, RecommendationStatus } from "@/features/initiative-7/types/inventory"
import { statusDistribution } from "@/features/initiative-7/utils/inventory-calc"

const STATUS_COLOR: Record<RecommendationStatus, string> = {
  "Pending Review": "var(--chart-4)",
  "In Approval": "var(--chart-1)",
  Approved: "var(--chart-3)",
  Implemented: "var(--chart-5)",
  Returned: "var(--warning)",
  Rejected: "var(--destructive)",
}

/** Every status the legend always shows, in this fixed order, even at a
 * count of zero -- a dashboard reads as a real business view only when every
 * category is visible, not just whichever ones happen to have data right
 * now (a queue with 1 real submission and 0 approvals should still show
 * "Approved: 0", not omit the row entirely). */
const STATUS_ORDER: RecommendationStatus[] = [
  "Pending Review",
  "In Approval",
  "Approved",
  "Implemented",
  "Returned",
  "Rejected",
]

function StatusTooltip({ active, payload }: TooltipContentProps) {
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

export function RecommendationStatusChart({
  recommendations = RECOMMENDATIONS,
  activeStatus,
  onStatusClick,
  statusOverride,
}: {
  recommendations?: Recommendation[]
  activeStatus?: RecommendationStatus | null
  onStatusClick?: (status: RecommendationStatus) => void
  /** Part 36 -- portfolio-wide { status, count }[], already reduced to the
   * frontend's own 6 display statuses (see mapStatus's STATUS_MAP -- several
   * backend statuses collapse into one display value, so this must already
   * be merged by the caller, not raw backend statuses). In live mode
   * `recommendations` is at most one fetched page, so this chart would
   * otherwise read as a portfolio distribution when it is really one page's
   * (see use-live-recommendation-summary.ts). */
  statusOverride?: { status: RecommendationStatus; count: number }[]
}) {
  const counted = statusOverride ?? statusDistribution(recommendations)
  const byStatus = new Map(counted.map((d) => [d.status, d.count]))
  // The legend always lists all 6 statuses (zero included); the pie itself
  // only plots the non-zero slices, since a 0-value wedge has no angle to
  // render and Recharts would otherwise still count it in some layouts.
  const legendData = STATUS_ORDER.map((status) => ({ status, count: byStatus.get(status) ?? 0 }))
  const pieData = legendData.filter((d) => d.count > 0)

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="status"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              // A real but tiny slice (e.g. 1 of 226,930) gets an angle too
              // small to render as a visible wedge, even though its color is
              // correct -- minAngle guarantees every non-zero slice is at
              // least this many degrees, the same "make the real thing
              // visible" fix already applied to the Stockout Risk bar (see
              // inventory-health-card.tsx's segmentHeightsPx).
              minAngle={8}
              stroke="none"
              isAnimationActive={false}
              onClick={(entry) => {
                const status = (entry as { status?: RecommendationStatus })?.status
                if (status) onStatusClick?.(status)
              }}
              cursor={onStatusClick ? "pointer" : undefined}
            >
              {pieData.map((d) => (
                <Cell
                  key={d.status}
                  fill={STATUS_COLOR[d.status]}
                  opacity={activeStatus && activeStatus !== d.status ? 0.3 : 1}
                />
              ))}
            </Pie>
            <Tooltip content={StatusTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {legendData.map((d) => (
          <button
            key={d.status}
            type="button"
            onClick={() => onStatusClick?.(d.status)}
            disabled={!onStatusClick}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-sm transition-colors",
              onStatusClick && "cursor-pointer hover:bg-muted/50",
              activeStatus && activeStatus !== d.status && "opacity-40"
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[d.status] }}
              />
              <span className="truncate">{d.status}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatCount(d.count)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
