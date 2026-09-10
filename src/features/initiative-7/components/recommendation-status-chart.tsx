"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts"

import { cn } from "@/lib/utils"
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
}: {
  recommendations?: Recommendation[]
  activeStatus?: RecommendationStatus | null
  onStatusClick?: (status: RecommendationStatus) => void
}) {
  const data = statusDistribution(recommendations)

  return (
    <div className="flex items-center gap-4">
      <div className="h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              onClick={(entry) => {
                const status = (entry as { status?: RecommendationStatus })?.status
                if (status) onStatusClick?.(status)
              }}
              cursor={onStatusClick ? "pointer" : undefined}
            >
              {data.map((d) => (
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
      <div className="flex flex-1 flex-col gap-2">
        {data.map((d) => (
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
            <span className="flex items-center gap-2 text-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[d.status] }}
              />
              {d.status}
            </span>
            <span className="tabular-nums text-muted-foreground">{d.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
