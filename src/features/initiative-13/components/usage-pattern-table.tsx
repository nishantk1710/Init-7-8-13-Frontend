"use client"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MonthlyConsumption, UsagePattern } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"

const BAND_TONE = { FAST: "success", SLOW: "warning", NON_MOVING: "danger" } as const

/**
 * One bar per month of net goods issues, scaled to this row's own busiest month.
 *
 * Per-row scaling on purpose: the question a planner asks of this column is
 * "is this part used steadily, in bursts, or not lately?", which is about one
 * material's shape, not how it compares to the busiest part in the plant.
 */
function MonthBars({ months }: { months: MonthlyConsumption[] }) {
  const peak = Math.max(0, ...months.map((m) => m.issuedQuantity))
  return (
    <div className="flex h-8 items-end gap-[2px]" aria-hidden>
      {months.map((m) => {
        const height = peak > 0 && m.issuedQuantity > 0 ? Math.max(8, (m.issuedQuantity / peak) * 100) : 0
        return (
          <div
            key={m.month}
            title={`${m.month}: ${formatCount(m.issuedQuantity)} issued in ${m.issueCount} movement${m.issueCount === 1 ? "" : "s"}; ${formatCount(m.receivedQuantity)} received`}
            className="flex h-full w-2 items-end rounded-sm bg-muted"
          >
            {height > 0 && <div className="w-full rounded-sm bg-primary" style={{ height: `${height}%` }} />}
          </div>
        )
      })}
    </div>
  )
}

export function UsagePatternTable({ rows }: { rows: UsagePattern[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No movement history matches these filters."
        description="Usage is built from goods issues and receipts in the delivered MSEG extract."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Aging band</TableHead>
            <TableHead>Monthly issues</TableHead>
            <TableHead className="text-right">Issued (history)</TableHead>
            <TableHead className="text-right">Active months</TableHead>
            <TableHead>Last issue</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Avg / month</TableHead>
            <TableHead className="text-right">Months of cover</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.material}::${row.plant}`}>
              <TableCell className="font-medium text-foreground">
                <div className="flex flex-col gap-0.5">
                  <span>{row.material}</span>
                  <AskAssistantLink materialId={row.material} plant={row.plant} variant="chip" label="Ask" />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.plant}</TableCell>
              <TableCell>
                {row.agingBand ? (
                  <StatusBadge tone={BAND_TONE[row.agingBand]}>{row.agingBand.replace("_", " ")}</StatusBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <MonthBars months={row.months} />
              </TableCell>
              <TableCell className="text-right text-foreground">{formatCount(row.issuedQuantityTotal)}</TableCell>
              <TableCell className="text-right text-foreground">
                {row.activeMonths} / {row.months.length}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.lastIssueMonth ?? "Never"}</TableCell>
              <TableCell className="text-right text-foreground">
                {row.stockOnHand === null ? "—" : formatCount(row.stockOnHand)}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {row.averageMonthlyConsumption === null ? "—" : row.averageMonthlyConsumption.toFixed(1)}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {row.monthsOfCover === null ? (
                  <span className="text-muted-foreground" title="No consumption to divide by">
                    —
                  </span>
                ) : (
                  row.monthsOfCover.toFixed(1)
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
