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

import { BUCKET_COLORS } from "@/features/initiative-8/components/repair-aging-chart"
import type { RepairChain, RepairStatus } from "@/features/initiative-8/types/repair"
import { DEFAULT_AGING_BUCKETS, isOpenRepair } from "@/features/initiative-8/utils/status"
import { formatCount } from "@/lib/utils"

/**
 * Aging per lifecycle stage (FR-9).
 *
 * The chart beside this one buckets lines by `daysOpen` — the whole-repair
 * clock, running from the PO line's creation date. FR-9 asks for aging bands
 * "per lifecycle stage", which is a different question and the one this
 * answers: of the lines sitting at a vendor right now, how long have they been
 * sitting there?
 *
 * A line 200 days open but 3 days at the vendor is not the same problem as one
 * 200 days open and 190 at the vendor. The first is a slow start; the second
 * is a vendor who has stopped answering. Only this split tells them apart.
 *
 * ## Open lines only
 *
 * A received or closed line is not "in" a stage any more — its days-in-stage
 * is the age of a finished thing and stacking it here would inflate every bar
 * with work nobody has to chase.
 *
 * ## Colour
 *
 * The band colours come from `repair-aging-chart` rather than being chosen
 * again. The two charts sit on the same page showing the same bands, and a
 * second palette for the same vocabulary would read as a second meaning.
 */

/** The stages an open repair line can sit in. Always on the axis, even empty. */
const OPEN_STAGES: readonly RepairStatus[] = ["PR Raised", "PO Issued", "At Vendor"]

type StageRow = { stage: string; total: number } & Record<string, number | string>

/**
 * Which band a day count falls in, against the configured band labels.
 *
 * The bands are backend configuration (`I8_AGING_BAND_BOUNDARIES`) served as
 * labels like "0-15" and "60+", so the boundaries are parsed from the labels
 * rather than duplicated here — two copies of a band list drift, and the
 * failure is silent.
 */
function bandOf(days: number, bands: string[]): string | null {
  for (const band of bands) {
    const open = band.match(/^(\d+)\+$/)
    if (open) {
      if (days >= Number(open[1])) return band
      continue
    }
    const range = band.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range && days >= Number(range[1]) && days <= Number(range[2])) return band
  }
  return null
}

function StageTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as StageRow | undefined
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(row.total)} open {row.total === 1 ? "line" : "lines"}
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {String(label)}, by days in this stage
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {payload
          .filter((p) => typeof p.value === "number" && p.value > 0)
          .map((p) => (
            <div
              key={String(p.dataKey)}
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <span
                className="size-2 rounded-[2px]"
                style={{ background: p.color }}
              />
              <span>{String(p.dataKey)} days</span>
              <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
                {formatCount(Number(p.value))}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

export function StageAgingChart({
  chains,
  bands = DEFAULT_AGING_BUCKETS,
}: {
  chains: RepairChain[]
  /** The active aging bands, from `LiveRegister.agingBands` in live mode. */
  bands?: string[]
}) {
  const open = chains.filter(isOpenRepair)

  const data: StageRow[] = OPEN_STAGES.map((stage) => {
    const row: StageRow = { stage, total: 0 }
    for (const band of bands) row[band] = 0
    for (const chain of open) {
      if (chain.repairStatus !== stage) continue
      // No days-in-stage figure means the backend could not place this line in
      // a stage clock. Counted in the total it belongs to is worse than left
      // out: it would land in whichever band happened to be first.
      if (chain.daysInCurrentStage === undefined) continue
      const band = bandOf(chain.daysInCurrentStage, bands)
      if (!band) continue
      row[band] = Number(row[band]) + 1
      row.total += 1
    }
    return row
  })

  const anyData = data.some((row) => row.total > 0)
  if (!anyData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-xs text-muted-foreground">
        No open repair line carries a days-in-stage figure, so aging per stage
        cannot be shown. This is not &ldquo;nothing is aging&rdquo;.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="stage"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <Tooltip content={StageTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        {/* Five bands is five series, so identity is never colour-alone. */}
        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
        />
        {bands.map((band, i) => (
          <Bar
            key={band}
            dataKey={band}
            stackId="stage"
            fill={BUCKET_COLORS[i % BUCKET_COLORS.length]}
            // A 2px surface gap between stacked segments, so adjacent bands
            // read as separate fills rather than one blended block.
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === bands.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
