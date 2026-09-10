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

import { formatZARCompact } from "@/lib/utils"

function DeptTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  if (typeof value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{formatZARCompact(value)}</div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  )
}

/** Unutilized OAR value by requesting department, horizontal bars. */
export function DepartmentValueChart({ data }: { data: { department: string; value: number }[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(v: number) => formatZARCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="department"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={90}
          />
          <Tooltip content={DeptTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
