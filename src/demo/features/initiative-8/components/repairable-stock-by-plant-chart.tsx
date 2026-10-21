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

import { I8_PLANTS } from "@demo/features/initiative-8/data/config"
import type { UniverseRow } from "@demo/features/initiative-8/types/repair"
import { formatCount } from "@demo/lib/utils"

interface PlantStock {
  plant: string
  stock: number
  materials: number
  /** Material-plant rows with no MARD row: stock unknown, left out of the sum. */
  unknown: number
}

function PlantTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  const row = point.payload as PlantStock
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{formatCount(point.value)} units on hand</div>
      <div className="mt-0.5 text-muted-foreground">
        {row.plant} · {formatCount(row.materials)} repairable{" "}
        {row.materials === 1 ? "material" : "materials"}
      </div>
      {row.unknown > 0 && (
        <div className="mt-0.5 text-muted-foreground">
          {formatCount(row.unknown)} with no MARD row, so not counted
        </div>
      )}
    </div>
  )
}

/**
 * Stock on hand by plant over the repairable universe (FR-1) — every 80-series
 * material at the plant, not just the ones with a repair line, and each
 * material-plant row once. A row with no MARD record adds nothing: its stock
 * is unknown, which is not the same as zero, and the tooltip says how many.
 */
export function RepairableStockByPlantChart({ rows }: { rows: UniverseRow[] }) {
  const byPlant = new Map<string, PlantStock>()
  for (const row of rows) {
    const entry = byPlant.get(row.plant.plantId) ?? {
      plant: row.plant.name,
      stock: 0,
      materials: 0,
      unknown: 0,
    }
    entry.materials += 1
    if (row.stockOnHand === undefined) entry.unknown += 1
    else entry.stock += row.stockOnHand
    byPlant.set(row.plant.plantId, entry)
  }
  // The configured plant order, so the bars do not swap places between views.
  const order = (plantId: string) => {
    const index = I8_PLANTS.findIndex((p) => p.plantId === plantId)
    return index === -1 ? I8_PLANTS.length : index
  }
  const data = [...byPlant.entries()]
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([, entry]) => entry)

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="plant"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={36}
            allowDecimals={false}
          />
          <Tooltip content={PlantTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar
            dataKey="stock"
            fill="var(--chart-3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
