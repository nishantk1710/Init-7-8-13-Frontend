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
import { AgingBucketsChart } from "@/features/initiative-13/components/aging-buckets-chart"
import { DashboardPagination } from "@/features/initiative-13/components/dashboard-pagination"
import { usePaginatedRows } from "@/features/initiative-13/hooks/use-paginated-rows"
import type { AcquiredVsPlanStatus, WatchMetric } from "@/lib/api/i13"
import { acquiredVsPlanRowsToCsv, countByField } from "@/features/initiative-13/utils/dashboard-transforms"
import { downloadCsv, formatCount } from "@/lib/utils"

const PLAN_LABEL: Record<AcquiredVsPlanStatus, string> = {
  NO_PLAN: "No plan",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "Aligned",
  ABOVE_PLAN: "Above plan",
}

const PLAN_TONE: Record<AcquiredVsPlanStatus, "default" | "success" | "warning" | "danger"> = {
  NO_PLAN: "default",
  BELOW_PLAN: "warning",
  ON_PLAN: "success",
  ABOVE_PLAN: "danger",
}

/** Acquired vs. Plan (§9): backend-computed `acquired_vs_plan_status` and
 * variance, rendered as-is — no tolerance/comparison rule is recreated
 * here. */
export function AcquiredVsPlanPanel({ rows }: { rows: WatchMetric[] }) {
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } = usePaginatedRows(rows)
  const distribution = useMemo(
    () => countByField(rows, (r) => r.acquiredVsPlanStatus).map((d) => ({ ...d, bucket: PLAN_LABEL[d.bucket as AcquiredVsPlanStatus] ?? d.bucket })),
    [rows]
  )

  function exportCsv() {
    downloadCsv(
      "i13-acquired-vs-plan.csv",
      ["Material", "Plant", "Planned qty", "Received (acquired) qty", "Issued qty", "Variance qty", "Variance %", "Status"],
      acquiredVsPlanRowsToCsv(rows)
    )
  }

  if (rows.length === 0) {
    return <EmptyState title="No acquired-vs-plan data for the selected filters." />
  }

  return (
    <div className="flex flex-col gap-3">
      <AgingBucketsChart data={distribution} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{formatCount(rows.length)} position(s)</p>
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
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Issued</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r) => (
              <TableRow key={`${r.material}-${r.plant}`}>
                <TableCell className="font-medium text-foreground">{r.material}</TableCell>
                <TableCell className="text-muted-foreground">{r.plant}</TableCell>
                <TableCell className="text-right text-foreground">
                  {r.plannedQuantity !== null ? formatCount(r.plannedQuantity) : "—"}
                </TableCell>
                {/* Em-dash, not zero. A null received quantity means nothing
                    was recorded; zero means nothing arrived. On a variance
                    table the two point at different problems. */}
                <TableCell className="text-right text-foreground">
                  {r.receivedQuantity !== null ? formatCount(r.receivedQuantity) : "—"}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  {r.issuedQuantity !== null ? formatCount(r.issuedQuantity) : "—"}
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
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={PLAN_TONE[r.acquiredVsPlanStatus]}>{PLAN_LABEL[r.acquiredVsPlanStatus]}</StatusBadge>
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
