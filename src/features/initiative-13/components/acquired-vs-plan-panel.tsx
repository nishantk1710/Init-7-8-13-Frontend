"use client"

import type { ReactNode } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
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
import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"
import { exportWatchRows } from "@/features/initiative-13/export-actions"
import type { WatchMetric } from "@/lib/api/i13"
import { acquiredVsPlanRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import {
  badgeTone,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import { downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** Acquired vs. Plan (§9): backend-computed `acquired_vs_plan_status` and
 * variance, rendered as-is — no tolerance/comparison rule is recreated
 * here. One server page of 25, most recent activity first; the export fetches
 * every position the filters match. */
export function AcquiredVsPlanPanel({
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
      "i13-acquired-vs-plan.xlsx",
      ["Material", "Plant", "Planned qty", "Received (acquired) qty", "Issued qty", "Variance qty", "Variance %", "Status"],
      acquiredVsPlanRowsToCsv(await exportWatchRows(filters))
    )
  }

  if (rows.length === 0 && !total) {
    return <EmptyState title="No acquired-vs-plan data for the selected filters." />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(total ?? rows.length)} position{(total ?? rows.length) === 1 ? "" : "s"}, most recent activity
          first
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Issued</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.material}-${r.plant}`}>
                <TableCell>
                  <MaterialName material={r.material} description={r.materialDescription} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(r.plant)}</TableCell>
                <TableCell className="text-right text-foreground">
                  {r.plannedQuantity !== null ? formatCount(r.plannedQuantity) : <EmptyValue kind="noPlanCaptured" />}
                </TableCell>
                {/* A label, not zero. A null received quantity means nothing
                    was recorded; zero means nothing arrived. On a variance
                    table the two point at different problems. */}
                <TableCell className="text-right text-foreground">
                  {r.receivedQuantity !== null ? formatCount(r.receivedQuantity) : <EmptyValue kind="noneRecorded" />}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {r.issuedQuantity !== null ? formatCount(r.issuedQuantity) : <EmptyValue kind="noneRecorded" />}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {r.acquiredVsPlanVarianceQuantity !== null ? (
                    <>
                      {formatCount(r.acquiredVsPlanVarianceQuantity)}
                      {r.acquiredVsPlanVariancePercentage !== null && (
                        <span className="text-muted-foreground"> ({r.acquiredVsPlanVariancePercentage}%)</span>
                      )}
                    </>
                  ) : (
                    <EmptyValue kind="noPlanToCompare" />
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={badgeTone(PLAN_STATUS_TONE[r.acquiredVsPlanStatus])}>
                    {PLAN_STATUS_LABEL[r.acquiredVsPlanStatus]}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pagination}
    </div>
  )
}
