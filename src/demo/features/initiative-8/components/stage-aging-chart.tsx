"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { AGING_BUCKET_COLORS } from "@demo/features/initiative-8/components/repair-aging-chart"
import type { AgingBucket, LifecycleStage, RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  AGING_BUCKETS,
  STAGE_LABEL,
  STAGE_ORDER,
  isOpenRepair,
} from "@demo/features/initiative-8/utils/status"
import { formatCount } from "@demo/lib/utils"

/** The stages an open line normally sits in; always on the axis, even when empty. */
const OPEN_STAGES: readonly LifecycleStage[] = ["PR_RAISED", "PO_ISSUED", "AT_VENDOR"]

type StageRow = { stage: string; total: number } & Record<AgingBucket, number>

function StageTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as StageRow | undefined
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(row.total)} open {row.total === 1 ? "line" : "lines"}
      </div>
      <div className="mt-0.5 text-muted-foreground">{label}, by days in this stage</div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {AGING_BUCKETS.filter((bucket) => row[bucket] > 0).map((bucket) => (
          <div key={bucket} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: AGING_BUCKET_COLORS[AGING_BUCKETS.indexOf(bucket)] }}
            />
            <span>{bucket} days</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
              {formatCount(row[bucket])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Aging per lifecycle stage (FR-9): the open lines grouped by the stage they
 * are in now, each stacked by how long it has sat *in that stage* — not by
 * days open overall, which is the Repair aging chart beside it. A PO that took
 * forty days to raise and a unit that has sat forty days at the vendor are
 * different problems with different owners, and the whole-repair clock hides
 * which one it is.
 */
export function StageAgingChart({ chains }: { chains: RepairChain[] }) {
  const open = chains.filter(isOpenRepair)
  // Any other stage an open line happens to be in (a partial receipt, say)
  // joins the axis in lifecycle order rather than vanishing from the count.
  const stages = STAGE_ORDER.filter(
    (stage) => OPEN_STAGES.includes(stage) || open.some((line) => line.stage === stage),
  )
  const data: StageRow[] = stages.map((stage) => {
    const inStage = open.filter((line) => line.stage === stage)
    const row = { stage: STAGE_LABEL[stage], total: inStage.length } as StageRow
    for (const bucket of AGING_BUCKETS) {
      row[bucket] = inStage.filter((line) => line.stageAgingBucket === bucket).length
    }
    return row
  })

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="stage"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval={0}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={28}
            allowDecimals={false}
          />
          <Tooltip content={StageTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span className="text-muted-foreground">{String(value)} days</span>}
          />
          {AGING_BUCKETS.map((bucket, i) => (
            <Bar
              key={bucket}
              dataKey={bucket}
              name={bucket}
              stackId="stage-aging"
              fill={AGING_BUCKET_COLORS[i]}
              stroke="var(--card)"
              strokeWidth={1}
              maxBarSize={56}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
