"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/shared/table-pagination"
import { ExportButton } from "@/features/initiative-13/components/export-button"
import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"
import { exportNonMoverRows } from "@/features/initiative-13/export-actions"
import type { NonMoverRow } from "@/features/initiative-13/utils/dashboard-transforms"
import { nonMoverRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** "4,716 days" alone is hard to read at a glance; the years say how stale. */
function IdleFor({ days }: { days: number }) {
  return (
    <span className="tabular-nums">
      {formatCount(days)} days
      {days >= 365 && (
        <span className="ml-1 text-muted-foreground">({(days / 365).toFixed(1)} yrs)</span>
      )}
    </span>
  )
}

function CriticalBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted-foreground">Unknown</span>
  return <StatusBadge tone={value ? "danger" : "default"}>{value ? "Yes" : "No"}</StatusBadge>
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
  page,
  total,
  hrefFor,
  filters,
}: {
  rows: NonMoverRow[]
  page: number
  total: number | null
  hrefFor: (page: number) => string
  filters: WatchFilters
}) {
  async function exportExcel() {
    downloadExcel(
      "i13-non-movers.xlsx",
      ["Material", "Plant", "Aging band", "Days since movement", "Stock on hand", "Consumption (12m)", "Critical impact"],
      nonMoverRowsToCsv(await exportNonMoverRows(filters))
    )
  }

  if (rows.length === 0 && page === 1) {
    return (
      <EmptyState
        title="No non-moving materials"
        description="No OAR position is classified non-moving for the current filters."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(total ?? rows.length)} non-moving position{(total ?? rows.length) === 1 ? "" : "s"}, most
          recent activity first
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
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
                  {row.daysSinceLastMovement !== null ? <IdleFor days={row.daysSinceLastMovement} /> : "—"}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {row.stockOnHand !== null ? formatCount(row.stockOnHand) : "—"}
                </TableCell>
                <TableCell className="text-right text-foreground">{formatCount(row.consumptionCount12m)}</TableCell>
                <TableCell>
                  <CriticalBadge value={row.criticalImpactIndicator} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        total={total}
        count={rows.length}
        noun="non-movers"
        hrefFor={hrefFor}
      />
    </div>
  )
}
