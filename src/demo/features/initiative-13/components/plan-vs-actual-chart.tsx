"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

const PLANNED = { key: "planned", name: "Planned", color: "var(--chart-1)" }
const ACTUAL = { key: "actual", name: "Actual", color: "var(--chart-3)" }

function PlanTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Planned vs. actual consumption line counts by month. */
export function PlanVsActualChart({ data }: { data: { month: string; planned: number; actual: number }[] }) {
  return (
    <div className="w-full">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barCategoryGap="28%" barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
            <Tooltip content={PlanTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar dataKey={PLANNED.key} name={PLANNED.name} fill={PLANNED.color} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Bar dataKey={ACTUAL.key} name={ACTUAL.name} fill={ACTUAL.color} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        {[PLANNED, ACTUAL].map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  )
}
