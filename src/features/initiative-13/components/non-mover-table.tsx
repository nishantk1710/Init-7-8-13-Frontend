"use client"

import type { ReactNode } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExportButton } from "@/features/initiative-13/components/export-button"
import { DataTable } from "@/features/initiative-13/components/ui/data-table"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { TONE_INK } from "@/features/initiative-13/components/ui/tones"
import { idleTone, isLongIdle } from "@/features/initiative-13/utils/oar-display"
import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"
import { exportNonMoverRows } from "@/features/initiative-13/export-actions"
import type { NonMoverRow } from "@/features/initiative-13/utils/dashboard-transforms"
import { nonMoverRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { cn, downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/**
 * "4,716 days" alone is hard to read at a glance; the years say how stale.
 * Red from 150 days, amber below -- the number says it too.
 */
function IdleFor({ days }: { days: number }) {
  const tone = idleTone(days)
  return (
    <div className="ml-auto text-right">
      <span className={cn("font-bold tabular-nums", TONE_INK[tone])}>
        {formatCount(days)} days
        {days >= 365 && <span className="ml-1 font-medium text-ink-muted">({(days / 365).toFixed(1)} yrs)</span>}
        {isLongIdle(days) && <span className="sr-only"> (idle 150 days or more)</span>}
      </span>
    </div>
  )
}

function CriticalBadge({ value }: { value: boolean | null }) {
  if (value === null) return <StatusPill tone="neutral">Unknown</StatusPill>
  return <StatusPill tone={value ? "urgent" : "neutral"}>{value ? "Yes" : "No"}</StatusPill>
}

/**
 * Non-Mover Drilldown (§8): the backend-classified `NON_MOVING` rows,
 * with the plant column always visible and the critical-impact column
 * joined in from W6.5 (§ see `attachCriticalImpactIndicator`) — the two
 * FRS-required drilldown dimensions.
 *
 * One server page of 25, most recent activity first (the backend's order, by
 * last goods movement), out of every non-mover the filters match -- not the
 * non-movers among a first batch of positions. The export fetches all of them.
 */
export function NonMoverTable({
  rows,
  total,
  pagination,
  filters,
}: {
  rows: NonMoverRow[]
  total: number | null
  /**
   * The pager, rendered by the server page and handed in as a node. Not built
   * here from an `hrefFor` function: a function cannot cross from a server
   * component to a client one, and passing one made the dashboard fail to
   * render at all.
   */
  pagination: ReactNode
  filters: WatchFilters
}) {
  async function exportExcel() {
    downloadExcel(
      "i13-non-movers.xlsx",
      ["Material", "Plant", "Aging band", "Days since movement", "Stock on hand", "Consumption (12m)", "Critical impact"],
      nonMoverRowsToCsv(await exportNonMoverRows(filters))
    )
  }

  if (rows.length === 0 && !total) {
    return (
      <EmptyState
        title="No non-moving materials"
        description="No OAR position is classified non-moving for the current filters."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          <span className="font-bold text-ink">{formatCount(total ?? rows.length)}</span> non-moving position
          {(total ?? rows.length) === 1 ? "" : "s"}, most recent activity first
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Idle for</TableHead>
              <TableHead className="text-right">Stock on hand</TableHead>
              <TableHead className="text-right">Consumption (12m)</TableHead>
              <TableHead>Critical impact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.material}-${row.plant}`}>
                <TableCell>
                  <MaterialName material={row.material} description={row.materialDescription} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
                <TableCell className="text-right text-foreground">
                  {row.daysSinceLastMovement !== null ? <IdleFor days={row.daysSinceLastMovement} /> : <EmptyValue kind="noMovement" />}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {row.stockOnHand !== null ? <span className="font-semibold">{formatCount(row.stockOnHand)}</span> : <EmptyValue kind="noStockRecord" />}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">{formatCount(row.consumptionCount12m)}</TableCell>
                <TableCell>
                  <CriticalBadge value={row.criticalImpactIndicator} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
      {pagination}
    </div>
  )
}
