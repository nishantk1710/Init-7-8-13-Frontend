"use client"

// Monthly performance and trends: how excess inventory, the recommendations I07 generated and the approval activity moved over
// the last months.
//
// Each chart draws what was recorded at the time, from the report's own saved section. A month with no figure -- before the
// history began, not started, or with no valid month-end snapshot -- is a gap, never a zero, and the card says which. Approval
// activity is counted from dated approval events, not from today's status. SAP implementation has no monthly series (the
// adoption result is saved as the latest per recommendation, not as dated events), and the section says so.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { ChartCard } from "@/components/shared/chart-card"
import { formatCount } from "@/lib/utils"
import type { ApiPerformanceTrends } from "@/features/initiative-7/types/api"
import { moneyExact } from "@/features/initiative-7/utils/quarterly-management"
import { MIN_EXCESS_POINTS, performancePoints, pointCount, type PerformancePoint } from "@/features/initiative-7/utils/quarterly-sections"
import { PerspectiveTag } from "@/features/initiative-7/components/monthly-report-sections"

function Tooltips({ active, payload, label, money, currency }: TooltipContentProps & { money?: boolean; currency?: string | null }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) =>
        typeof entry.value === "number" ? (
          <div key={String(entry.dataKey)} className="mt-1 text-muted-foreground">
            {entry.name}: {money ? moneyExact(entry.value, currency ?? null) : formatCount(Math.round(entry.value))}
          </div>
        ) : null,
      )}
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center px-2 text-center text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  )
}

const missingMonths = (points: PerformancePoint[], keys: (keyof Omit<PerformancePoint, "label">)[]) =>
  points.filter((p) => keys.every((key) => p[key] === null)).map((p) => p.label)

/** A. Month-end excess inventory value, from the saved snapshots. */
function ExcessTrendCard({ performance, points }: { performance: ApiPerformanceTrends; points: PerformancePoint[] }) {
  const currency = performance.months.find((m) => m.currency)?.currency ?? null
  const drawable = pointCount(points, ["excess"]) >= MIN_EXCESS_POINTS
  const gaps = missingMonths(points, ["excess"])
  return (
    <ChartCard
      title="Excess inventory trend"
      subtitle="Estimated value of stock above the recommended maximum, at each month's end"
      span={4}
      footnote={drawable && gaps.length > 0 ? `No month-end snapshot for ${gaps.join(", ")}.` : undefined}
    >
      <PerspectiveTag perspective="snapshot" />
      {drawable ? (
        <>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 22, right: 24, left: 24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  content={(props: TooltipContentProps) => <Tooltips {...props} money currency={currency} />}
                />
                {/* connectNulls off: a month with no snapshot breaks the line instead of being joined across. */}
                <Line
                  type="monotone"
                  dataKey="excess"
                  name="Excess value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-1)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {points
              .filter((p) => p.excess !== null)
              .map((p) => (
                <li key={p.label}>
                  {p.label}: <span className="tabular-nums text-foreground">{moneyExact(p.excess, currency)}</span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <Empty>
          {pointCount(points, ["excess"]) === 1
            ? "Only one month has a saved month-end snapshot, so there is no trend yet. A past month cannot be rebuilt from today's data."
            : "No month has a saved month-end snapshot yet, so there is no trend. A past month cannot be rebuilt from today's data."}
        </Empty>
      )}
    </ChartCard>
  )
}

/** B. Recommendation records against the distinct material-plants they cover. */
function GeneratedTrendCard({ points: allPoints }: { points: PerformancePoint[] }) {
  // Just the report's month and the one before it: the older months only repeat "no figure".
  const points = allPoints.slice(-2)
  const drawable = pointCount(points, ["records", "materialPlants"]) > 0
  const gaps = missingMonths(points, ["records", "materialPlants"])
  return (
    <ChartCard
      title="Recommendations generated"
      subtitle="Records created each month, beside the distinct material-plants they cover"
      span={4}
      footnote={drawable && gaps.length > 0 ? `No figure for ${gaps.join(", ")}.` : undefined}
    >
      <PerspectiveTag perspective="monthly" />
      {drawable ? (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={(props: TooltipContentProps) => <Tooltips {...props} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="records" name="Records" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar
                dataKey="materialPlants"
                name="Distinct material-plants"
                fill="var(--chart-3)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>No recommendation has been generated in these months.</Empty>
      )}
    </ChartCard>
  )
}

/** C. Approval activity from the dated approval history. */
function ApprovalTrendCard({ points }: { points: PerformancePoint[] }) {
  const keys = ["submitted", "approved", "rejected", "sentBack"] as const
  const drawable = pointCount(points, [...keys]) > 0
  const gaps = missingMonths(points, [...keys])
  return (
    <ChartCard
      title="Approval activity"
      subtitle="Decisions recorded each month, counted when they happened"
      span={4}
      footnote={drawable && gaps.length > 0 ? `No figure for ${gaps.join(", ")}.` : undefined}
    >
      <PerspectiveTag perspective="monthly" />
      {drawable ? (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={(props: TooltipContentProps) => <Tooltips {...props} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="submitted" name="Sent for approval" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="approved" name="Approval decisions" fill="var(--chart-3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="rejected" name="Rejections" fill="var(--chart-4)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="sentBack" name="Sent back" fill="var(--chart-5)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>No approval event has been recorded in these months.</Empty>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        SAP implementation is not charted: adoption is saved as the latest result per recommendation, not as dated events, so it cannot be
        placed in a month.
      </p>
    </ChartCard>
  )
}

/** The section: three cards over the last months, then what the report says about how the months were measured. */
export function PerformanceTrends({ performance }: { performance: ApiPerformanceTrends }) {
  const points = performancePoints(performance)
  return (
    <>
      <div className="lg:col-span-12">
        <h3 className="text-sm font-medium text-foreground">Monthly performance and trends</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The last {performance.months.length} months, from what was recorded at the time. A month with no figure is a gap, not a zero.
        </p>
      </div>
      <ExcessTrendCard performance={performance} points={points} />
      <GeneratedTrendCard points={points} />
      <ApprovalTrendCard points={points} />
      <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:col-span-12">
        <summary className="cursor-pointer font-medium text-foreground">How the trends are measured</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 leading-relaxed">
          {performance.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </>
  )
}
