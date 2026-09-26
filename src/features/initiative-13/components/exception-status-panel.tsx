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
import type { ActException, ActExceptionStatus } from "@/lib/api/i13"
import { countByField, exceptionRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { downloadCsv, formatCount } from "@/lib/utils"

const STATUS_TONE: Record<ActExceptionStatus, "default" | "success" | "warning" | "danger"> = {
  OPEN: "default",
  AWAITING_REQUESTER: "warning",
  CONFIRMED: "warning",
  ESCALATED: "danger",
  RESOLVED: "success",
}

/** Exception Status (§12): consumes W6.6's ACT exception queue read-only.
 * No detection/escalation/state-transition logic runs here — this only
 * renders the `status`/`routing_status` the backend already assigned. */
export function ExceptionStatusPanel({ rows }: { rows: ActException[] }) {
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } = usePaginatedRows(rows)
  const distribution = useMemo(() => countByField(rows, (r) => r.status), [rows])

  function exportCsv() {
    downloadCsv(
      "i13-exceptions.csv",
      ["Type", "Material", "Plant", "Owner/requester", "Status", "Detected at", "Requester due", "Escalated at", "Routing status"],
      exceptionRowsToCsv(rows)
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No ACT exceptions for the selected filters."
        description="No open, escalated, or resolved plan-breach/no-plan/GRNI exception matches the current plant/material filter."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <AgingBucketsChart data={distribution} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{formatCount(rows.length)} exception(s)</p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Requester due</TableHead>
              <TableHead>Routing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((e) => (
              <TableRow key={e.exceptionId}>
                <TableCell className="text-foreground">{e.exceptionType}</TableCell>
                <TableCell className="font-medium text-foreground">{e.material}</TableCell>
                <TableCell className="text-muted-foreground">{e.plant}</TableCell>
                <TableCell className="text-muted-foreground">{e.ownerRequesterId ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[e.status]}>{e.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(e.detectedAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {e.requesterDueAt ? new Date(e.requesterDueAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{e.routingStatus ?? "—"}</TableCell>
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
