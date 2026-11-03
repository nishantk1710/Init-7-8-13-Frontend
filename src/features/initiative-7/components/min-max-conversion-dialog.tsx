"use client"

// The materials behind the "Min-Max conversion" card: the OAR material-plants whose newest recommendation from the period is eligible
// to be converted to Min-Max ordering.
//
// The list is the Recommendations list, asked for the same thing the card counted (OAR, eligible, generated in the period): the card
// is worked out with that list's own filters on the backend, so the count on the card and the total here are the same number. It is
// fetched only once the dialog is open, so an ordinary page view never pays for it.

import Link from "next/link"

import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { TablePagination } from "@/components/shared/table-pagination"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Criticality } from "@/features/initiative-7/types/inventory"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { useState } from "react"

const PAGE_SIZE = 10

/** The same list the card counted. Mounted only while the dialog is open. */
function EligibleList({ generatedFrom, generatedTo }: { generatedFrom: string; generatedTo: string }) {
  const [page, setPage] = useState(1)
  const { data, total, loading } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    page,
    pageSize: PAGE_SIZE,
    type: "oar",
    conversionEligibility: "ELIGIBLE",
    generatedFrom,
    generatedTo,
  })
  const view = pagedTableView(loading, data)
  if (view === "skeleton") return <LoadingSpinner label="Loading materials" className="h-48 w-full" />
  if (view !== "rows" || !data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No OAR material-plant from this period is eligible for Min-Max conversion.</p>
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
                <TableCell className="text-right font-mono text-[13px] tabular-nums">{formatCount(rec.recommended.safetyStock)}</TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">{formatCount(rec.recommended.rop)}</TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">{formatCount(rec.recommended.maxStock)}</TableCell>
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
          <DialogTitle>Eligible for Min-Max conversion</DialogTitle>
          <DialogDescription>
            OAR material-plants whose newest recommendation from {periodLabel} is eligible to be converted to Min-Max ordering. Eligible is
            the rule&apos;s verdict, not a change made in SAP.
          </DialogDescription>
        </DialogHeader>
        {open && <EligibleList generatedFrom={generatedFrom} generatedTo={generatedTo} />}
      </DialogContent>
    </Dialog>
  )
}
