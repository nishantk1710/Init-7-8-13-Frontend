"use client"

import { useMemo } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApiVendorTurnaround } from "@/lib/api/i8"

/**
 * Vendor turnaround — dispatch (the 541) to goods receipt, in days.
 *
 * FR-10 asks for this and FR-3 defines the window. The 09-Oct audit found
 * `GET /api/i8/vendors/turnaround` had been live the whole time with no screen
 * calling it, so this is the screen.
 *
 * ## Why a sample size sits next to every average
 *
 * The average is over COMPLETED repairs that have BOTH ends of the clock — a
 * 541 and a receipt. Plenty of vendors have one or two such lines, and a mean
 * of one is not a record of anything. Showing "14 days" without "from 1
 * repair" invites somebody to put it in a vendor review.
 *
 * Rows with no measurable turnaround are kept rather than dropped, and say so.
 * A vendor absent from a turnaround table reads as a vendor with no repairs,
 * which is a different and wrong claim.
 */

/** Below this, an average is labelled rather than simply printed. */
const THIN_SAMPLE = 3

export type VendorTurnaroundTableProps = {
  vendors: ApiVendorTurnaround[]
  /** How many rows to show. The rest are summarised beneath. */
  limit?: number
}

export function VendorTurnaroundTable({
  vendors,
  limit = 10,
}: VendorTurnaroundTableProps) {
  const { shown, measurable, hiddenCount } = useMemo(() => {
    // Vendors with a real measurement first, slowest at the top -- the ones
    // worth a conversation. Then the unmeasurable ones, by how much work they
    // hold, so the table never just stops.
    const sorted = [...vendors].sort((a, b) => {
      const aHas = a.avgTurnaroundDays !== null
      const bHas = b.avgTurnaroundDays !== null
      if (aHas !== bHas) return aHas ? -1 : 1
      if (aHas && bHas) return (b.avgTurnaroundDays ?? 0) - (a.avgTurnaroundDays ?? 0)
      return b.totalLines - a.totalLines
    })
    return {
      shown: sorted.slice(0, limit),
      measurable: vendors.filter((v) => v.avgTurnaroundDays !== null).length,
      hiddenCount: Math.max(0, sorted.length - limit),
    }
  }, [vendors, limit])

  if (vendors.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-xs text-muted-foreground">
        No vendor turnaround could be measured. Turnaround needs a dispatch
        (541) and a goods receipt on the same line, and no closed repair line
        in this data has both.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {measurable} of {vendors.length} vendors have at least one closed repair
        with both a dispatch and a receipt. The rest hold repairs that cannot be
        timed yet.
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Avg Days</TableHead>
              <TableHead className="text-right">Range</TableHead>
              <TableHead className="text-right">From</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((v) => (
              <TableRow key={v.vendor}>
                <TableCell>
                  {/* An unnamed vendor shows its code. No LFA1 row was
                      delivered for some of them (FRS §8 item 6, still open
                      with VZI IT) -- a code is a fact, an invented name is
                      not. */}
                  <span className="text-foreground">
                    {v.vendorName ?? v.vendor}
                  </span>
                  {!v.vendorName && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      unnamed
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {v.avgTurnaroundDays === null ? (
                    <span className="text-xs text-muted-foreground">
                      not measurable
                    </span>
                  ) : (
                    <span className="text-foreground">
                      {Math.round(v.avgTurnaroundDays)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {v.minTurnaroundDays !== null && v.maxTurnaroundDays !== null
                    ? `${Math.round(v.minTurnaroundDays)}–${Math.round(v.maxTurnaroundDays)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {v.turnaroundSample === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : v.turnaroundSample < THIN_SAMPLE ? (
                    // A mean of one or two is an anecdote. Marked, not hidden.
                    <StatusBadge tone="warning">
                      {v.turnaroundSample} repair
                      {v.turnaroundSample === 1 ? "" : "s"}
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">
                      {v.turnaroundSample} repairs
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {v.openCount}
                </TableCell>
                <TableCell className="text-right">
                  {v.overdueCount > 0 ? (
                    <StatusBadge tone="danger">{v.overdueCount}</StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenCount} more vendor{hiddenCount === 1 ? "" : "s"} not shown.
        </p>
      )}
    </div>
  )
}
