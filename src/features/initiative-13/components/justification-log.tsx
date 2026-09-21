"use client"

import { Download } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { DashboardPagination } from "@/features/initiative-13/components/dashboard-pagination"
import { usePaginatedRows } from "@/features/initiative-13/hooks/use-paginated-rows"
import type { JustificationEntry } from "@/features/initiative-13/api/types"
import { justificationRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import { downloadCsv, formatCount } from "@/lib/utils"

/** Justification Log (§10): structured requester confirmations captured by
 * W6.6's ACT workflow. An audit/accountability view only — no exception
 * status is changed from here (submitting a new confirmation happens on the
 * ACT exception's own workflow, not on this dashboard). */
export function JustificationLog({ entries }: { entries: JustificationEntry[] }) {
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } = usePaginatedRows(entries)

  function exportCsv() {
    downloadCsv(
      "i13-justifications.csv",
      ["Exception ID", "Exception type", "Material", "Plant", "Requester", "Reason category", "Free text", "Submitted by", "Submitted at"],
      justificationRowsToCsv(entries)
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No justifications recorded for the selected filters."
        description="No requester has confirmed a plan-breach/no-plan exception with a structured justification yet for this plant/material."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{formatCount(entries.length)} justification(s)</p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {paged.map((entry) => (
          <div key={entry.exceptionId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">{entry.material}</span>
              <span className="text-muted-foreground">@ {entry.plant}</span>
              <span className="text-muted-foreground">· {entry.exceptionType}</span>
              <span className="ml-auto text-muted-foreground">{new Date(entry.submittedAt).toLocaleString()}</span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-foreground">{entry.reasonCategory}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.freeText}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Submitted by {entry.actorId}
              {entry.ownerRequesterId && entry.ownerRequesterId !== entry.actorId ? ` · Owner: ${entry.ownerRequesterId}` : ""}
            </p>
          </div>
        ))}
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
