"use client"

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
import { DashboardPagination } from "@/features/initiative-13/components/dashboard-pagination"
import { usePaginatedRows } from "@/features/initiative-13/hooks/use-paginated-rows"
import type { NonMoverRow } from "@/features/initiative-13/utils/dashboard-transforms"
import { nonMoverRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { downloadCsv, formatCount } from "@/lib/utils"

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
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } = usePaginatedRows(rows)

  function exportCsv() {
    downloadCsv(
      "i13-non-movers.csv",
      ["Material", "Plant", "Aging band", "Days since movement", "Stock on hand", "Consumption (12m)", "Critical impact"],
      nonMoverRowsToCsv(rows)
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No non-moving positions for the selected filters."
        description="No OAR material+plant position is currently classified NON_MOVING for this plant/material/critical-impact combination."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{formatCount(rows.length)} non-moving position(s)</p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Days since movement</TableHead>
              <TableHead className="text-right">Stock on hand</TableHead>
              <TableHead className="text-right">Consumption (12m)</TableHead>
              <TableHead>Critical impact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => (
              <TableRow key={`${row.material}-${row.plant}`}>
                <TableCell className="font-medium text-foreground">{row.material}</TableCell>
                <TableCell className="text-muted-foreground">{row.plant}</TableCell>
                <TableCell className="text-right text-foreground">
                  {row.daysSinceLastMovement !== null ? `${row.daysSinceLastMovement}d` : "—"}
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
      <DashboardPagination
        page={page}
        pageCount={pageCount}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={previous}
        onNext={next}
      />
    </div>
  )
}
