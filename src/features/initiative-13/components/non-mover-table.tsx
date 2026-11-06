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
import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"
import { exportNonMoverRows } from "@/features/initiative-13/export-actions"
import { NEVER_ISSUED, nonMoverRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { formatApiDate } from "@/lib/api/format"
import type { WatchMetric } from "@/lib/api/i13"
import { downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/**
 * The last goods issue (201/261, net of reversals) -- the date that makes a
 * position non-moving -- with how long ago it was. Not the last movement of
 * any type: a receipt or transfer last month says nothing about use, and read
 * as "idle 154 days" on a material unused for years.
 */
function LastIssued({ row }: { row: WatchMetric }) {
  if (!row.lastIssueDate) {
    return (
      <span className="font-semibold text-destructive" title="No goods issue in the movement history the platform holds.">
        {NEVER_ISSUED}
      </span>
    )
  }
  const days = row.daysSinceLastIssue
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="font-semibold text-foreground">{formatApiDate(row.lastIssueDate)}</span>
      {days !== null && (
        <span className="ml-1 text-muted-foreground">({days >= 365 ? `${(days / 365).toFixed(1)} yrs` : `${formatCount(days)} days`} ago)</span>
      )}
    </span>
  )
}

/**
 * Non-Mover Drilldown (§8): the backend-classified `NON_MOVING` rows -- no
 * goods issue for more than 730 days, or none at all. Four columns, only what
 * says the stock sits unused (6-Nov-2026): material, plant, when it was last
 * issued, and how much is on hand. Dropped: the critical-impact rating (on
 * record for almost no OAR position), the days since the last movement of any
 * type (a receipt or transfer is not use, and read as "idle 154 days" on a
 * material unused for years) and Consumption (12m), 0 on every row here.
 *
 * One server page of 25 out of every non-mover the filters match. The export
 * fetches all of them.
 */
export function NonMoverTable({
  rows,
  total,
  pagination,
  filters,
}: {
  rows: WatchMetric[]
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
      ["Material", "Plant", "Last issued", "Stock on hand"],
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
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCount(total ?? rows.length)}</span> non-moving position
          {(total ?? rows.length) === 1 ? "" : "s"}
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Last issued</TableHead>
              <TableHead className="text-right">Stock on hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.material}-${row.plant}`}>
                <TableCell>
                  <MaterialName material={row.material} description={row.materialDescription} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
                <TableCell className="text-right">
                  <LastIssued row={row} />
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {row.stockOnHand !== null ? <span className="font-semibold">{formatCount(row.stockOnHand)}</span> : <EmptyValue kind="noStockRecord" />}
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
