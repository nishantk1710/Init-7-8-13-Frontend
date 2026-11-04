"use client"

// The materials behind the "Min-Max conversion" card.
//
// It opens on the OAR material-plants converted in SAP -- the number on the card -- and a switch shows every one the rule says may
// convert, so the ones still waiting are visible too. The list is the Recommendations list, asked for the same thing the card counted
// (OAR, eligible, generated in the period, and for the first view SAP now matches): the backend works the card out with that list's own
// filters, so the count on the card and the total here are the same number. It is fetched only once the dialog is open.

import Link from "next/link"
import { useState } from "react"

import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Criticality } from "@/features/initiative-7/types/inventory"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { stockFigure } from "@/features/initiative-7/utils/stock-figure"

const PAGE_SIZE = 10

type View = "converted" | "eligible"

const VIEW_LABEL: Record<View, string> = { converted: "Moved in SAP", eligible: "Can move" }

/** A recommended figure, or a dash when the system has none for it -- never a 0 that nothing set. */
function figureCell(value: number | null) {
  return value === null ? <span className="text-muted-foreground">—</span> : formatCount(value)
}

/** The list for one view. Mounted only while the dialog is open. */
function MaterialList({ view, generatedFrom, generatedTo }: { view: View; generatedFrom: string; generatedTo: string }) {
  const [page, setPage] = useState(1)
  const { data, total, loading } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    page,
    pageSize: PAGE_SIZE,
    type: "oar",
    conversionEligibility: "ELIGIBLE",
    // Only material-plants that have a recommended value: one the rule allows but that has no value has nothing to move, and is not in the
    // card's count either. The same filter, so the card and this list agree.
    hasRecommended: true,
    adoptedInSap: view === "converted" ? true : undefined,
    generatedFrom,
    generatedTo,
  })
  const state = pagedTableView(loading, data)
  if (state === "skeleton") return <LoadingSpinner label="Loading materials" className="h-48 w-full" />
  if (state !== "rows" || !data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {view === "converted"
          ? "None of this period's OAR materials that can move has moved to Min-Max in SAP yet. Switch to “Can move” to see them."
          : "No OAR material from this period can move to Min-Max yet."}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {formatCount(total)} material-plant{total === 1 ? "" : "s"}, newest first.
      </p>
      <div
        className={cn("overflow-x-auto rounded-lg border border-border transition-opacity", loading && "opacity-50")}
        aria-busy={loading}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Crit.</TableHead>
              <TableHead className="text-right">Safety stock</TableHead>
              <TableHead className="text-right">Reorder point</TableHead>
              <TableHead className="text-right">Max stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Generated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell>
                  <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
                    <MaterialIdentity material={rec.material} />
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{rec.plantId}</TableCell>
                <TableCell className="text-xs">{CRITICALITY_TIER_LABEL[rec.criticality as Criticality]}</TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">
                  {figureCell(stockFigure(rec, "recommended", "safetyStock"))}
                </TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">
                  {figureCell(stockFigure(rec, "recommended", "rop"))}
                </TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">
                  {figureCell(stockFigure(rec, "recommended", "maxStock"))}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{rec.status}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rec.generatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        count={data.length}
        noun="material-plants"
        loading={loading}
        alwaysShowButtons
        onPageChange={setPage}
      />
    </div>
  )
}

/** The body of the dialog: the switch and the list. A different view is a different list, so it starts again on its first page. */
function Body({ generatedFrom, generatedTo }: { generatedFrom: string; generatedTo: string }) {
  const [view, setView] = useState<View>("converted")
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Which material-plants to list">
        {(Object.keys(VIEW_LABEL) as View[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={view === key ? "default" : "outline"}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {VIEW_LABEL[key]}
          </Button>
        ))}
      </div>
      <MaterialList key={view} view={view} generatedFrom={generatedFrom} generatedTo={generatedTo} />
    </div>
  )
}

/** The dialog the Min-Max conversion card opens. The period is the report's own, half-open: a record stamped late on the last day is in
 * it, one on the next day is not. */
export function MinMaxConversionDialog({
  open,
  onOpenChange,
  generatedFrom,
  generatedTo,
  periodLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  generatedFrom: string
  generatedTo: string
  periodLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Min-Max conversion</DialogTitle>
          <DialogDescription>
            OAR materials from {periodLabel} that have moved to Min-Max in SAP, or can move. “Can move” means the rule allows it and a
            recommended value has been worked out. Approval alone is not a move.
          </DialogDescription>
        </DialogHeader>
        {open && <Body generatedFrom={generatedFrom} generatedTo={generatedTo} />}
      </DialogContent>
    </Dialog>
  )
}
