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
import type { ActException } from "@/lib/api/i13"
import { exceptionRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import {
  badgeTone,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  EXCEPTION_TYPE_LABEL,
} from "@/features/initiative-13/utils/status-labels"
import { formatApiDateTime } from "@/lib/api/format"
import { downloadCsv, formatCount } from "@/lib/utils"

/** Exception Status (§12): consumes W6.6's ACT exception queue read-only.
 * No detection/escalation/state-transition logic runs here — this only
 * renders the `status`/`routing_status` the backend already assigned. */
export function ExceptionStatusPanel({ rows }: { rows: ActException[] }) {
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } = usePaginatedRows(rows)

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
        title="No exceptions in the queue"
        description="No plan-breach, no-plan or GR-not-issued exception matches the current filters."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{formatCount(rows.length)} exception{rows.length === 1 ? "" : "s"}</p>
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
                <TableCell className="text-foreground">{EXCEPTION_TYPE_LABEL[e.exceptionType] ?? e.exceptionType}</TableCell>
                <TableCell className="font-medium text-foreground">{e.material}</TableCell>
                <TableCell className="text-muted-foreground">{e.plant}</TableCell>
                <TableCell className="text-muted-foreground">{e.ownerRequesterId ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={badgeTone(EXCEPTION_STATUS_TONE[e.status])}>
                    {EXCEPTION_STATUS_LABEL[e.status] ?? e.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatApiDateTime(e.detectedAt)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatApiDateTime(e.requesterDueAt)}
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
