"use client"

import { useMemo } from "react"
import { Download } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/shared/table-pagination"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import type { NonMoverRow } from "@/features/initiative-13/utils/dashboard-transforms"
import { nonMoverRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
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
 * FRS-required drilldown dimensions. Rows are already filtered by the
 * caller (plant/material/critical-impact); this component only paginates
 * and exports what it is given.
 */
export function NonMoverTable({ rows }: { rows: NonMoverRow[] }) {
  // Longest-idle first: the drilldown exists to find stock that has sat the
  // longest. Unknown movement dates go last rather than reading as "fresh".
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => (b.daysSinceLastMovement ?? -1) - (a.daysSinceLastMovement ?? -1)
      ),
    [rows]
  )
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(sorted)

  function exportExcel() {
    downloadExcel(
      "i13-non-movers.xlsx",
      ["Material", "Plant", "Aging band", "Days since movement", "Stock on hand", "Consumption (12m)", "Critical impact"],
      nonMoverRowsToCsv(rows)
    )
  }

  if (rows.length === 0) {
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
        <p className="text-[11px] text-muted-foreground">{formatCount(rows.length)} non-moving position{rows.length === 1 ? "" : "s"}, longest idle first</p>
        <Button size="sm" variant="outline" onClick={exportExcel}>
          <Download className="size-3.5" />
          Export Excel
        </Button>
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
            {paged.map((row) => (
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
        pageSize={pageSize}
        total={total}
        count={paged.length}
        onPageChange={setPage}
      />
    </div>
  )
}
