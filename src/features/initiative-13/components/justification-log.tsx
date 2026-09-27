"use client"

import { Download } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { DashboardPagination } from "@/features/initiative-13/components/dashboard-pagination"
import { usePaginatedRows } from "@/features/initiative-13/hooks/use-paginated-rows"
import { isPlaceholderActor } from "@/lib/api/actor"
import {
  kindLabel,
  sourceLabel,
  type UnifiedJustification,
} from "@/lib/assistant/justifications"
import { downloadCsv, formatCount } from "@/lib/utils"
import { cn } from "@/lib/utils"

/**
 * Justification Log — every reason recorded for going ahead anyway, from both
 * places they are captured.
 *
 * **This used to show half the record.** It read only ACT exception
 * confirmations, which are written after the fact when somebody chases an
 * exception. The reasons captured at the moment of the decision — the
 * `NEW_ACQUISITION` and `QUANTITY_OVERRIDE` records that I08 FR-7 and I13
 * FR-3 ask for by name — live in the shared `justification` table and were
 * invisible on the screen built to display them.
 *
 * The two sources are disjoint (only the assistant writes the shared table),
 * so they concatenate. Each row says which it is, because "explained before
 * the reservation was made" and "explained weeks later when chased" are
 * different kinds of evidence about the same person's reasoning, and a log
 * that flattens them invites a reader to treat the second as the first.
 *
 * An audit view only: nothing is changed from here.
 */
export function JustificationLog({
  entries,
  csvFilename = "i13-justifications.csv",
}: {
  entries: UnifiedJustification[]
  /** The export's filename. Initiative 08's justification page renders this
   *  log too, and a file of I08 records should not be named for I13. */
  csvFilename?: string
}) {
  const { paged, page, pageCount, hasPrevious, hasNext, previous, next } =
    usePaginatedRows(entries)

  function exportCsv() {
    downloadCsv(
      csvFilename,
      [
        "Captured",
        "Kind",
        "Material",
        "Plant",
        "Reason category",
        "Free text",
        "Author",
        "Recorded at",
        "Session",
        "Exception",
      ],
      entries.map((entry) => [
        sourceLabel(entry.source),
        entry.kind,
        entry.material,
        entry.plant,
        entry.reasonCategory,
        entry.freeText,
        entry.author,
        entry.recordedAt,
        entry.sessionId ?? "",
        entry.exceptionId ?? "",
      ])
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No justifications recorded for the selected filters."
        description="Nobody has yet gone ahead against the assistant's advice, or confirmed a plan-breach or no-plan exception, for this plant and material."
      />
    )
  }

  const fromAssistant = entries.filter((e) => e.source === "ASSISTANT").length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(entries.length)} justification(s) · {fromAssistant} at
          reservation time, {entries.length - fromAssistant} chasing an
          exception
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {paged.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">
                {entry.material}
              </span>
              <span className="text-muted-foreground">@ {entry.plant}</span>
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {kindLabel(entry.kind)}
              </span>
              {/* Which moment this was captured in. See the note above. */}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px]",
                  entry.source === "ASSISTANT"
                    ? "bg-secondary text-secondary-foreground"
                    : "border border-border text-muted-foreground"
                )}
              >
                {sourceLabel(entry.source)}
              </span>
              <span className="ml-auto text-muted-foreground">
                {new Date(entry.recordedAt).toLocaleString()}
              </span>
            </div>

            <p className="mt-1.5 text-xs font-medium text-foreground">
              {entry.reasonCategory.replace(/_/g, " ")}
            </p>
            {/* The part a person actually reads when this is reviewed. A
                category on its own records that a box was ticked. */}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.freeText}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Recorded by{" "}
              <span
                className={cn(
                  isPlaceholderActor(entry.author) && "italic"
                )}
              >
                {entry.author}
              </span>
              {isPlaceholderActor(entry.author) && " (no sign-in — provisional)"}
              {entry.sessionId && ` · session ${entry.sessionId}`}
              {entry.exceptionId && ` · exception ${entry.exceptionId}`}
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
