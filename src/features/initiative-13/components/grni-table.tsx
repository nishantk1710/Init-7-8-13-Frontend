"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { IssuedOnCell, NextPlannedIssueCell } from "@/features/initiative-13/components/issued-on-cell"
import { ISSUE_MATCH_EXPLANATIONS, ISSUE_MATCH_LABELS } from "@/features/initiative-13/utils/issue-match"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatApiDate } from "@/lib/api/format"
import type { GrniEntry } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/**
 * Goods received and not issued for 30+ days, one row per PO line.
 *
 * "Issued" is what has gone out of the line's deliveries: its reservation's
 * issues where a reservation raised the PR, else the material's stock issues
 * counted against the oldest delivery first (the "How matched" column). The
 * age is the days since the line's **last** goods receipt, measured as of the
 * backend snapshot's date — the same rule, and the same threshold, WATCH
 * applies per material and plant. Nothing here re-derives it.
 */
export function GrniTable({ rows }: { rows: GrniEntry[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing has been sitting unissued past the threshold."
        description="No PO line with these filters was received and left with stock unissued for 30 days or more."
      />
    )
  }

  return (
    <DataTable className={FITTED_TABLE}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>PO</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Issued</TableHead>
            <TableHead className="text-right" title="Received and not yet issued">In stock</TableHead>
            <TableHead>Last GR</TableHead>
            <TableHead className="text-right">Days since GR</TableHead>
            <TableHead>Issued on</TableHead>
            <TableHead>Next planned issue</TableHead>
            <TableHead>How matched</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.poNumber}|${row.poItem}`}>
              <TableCell className="font-medium text-foreground">
                <div className="flex flex-col gap-0.5">
                  <MaterialName material={row.material} description={row.materialDescription} />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
              <TableCell>
                <DocNo number={row.poNumber} item={row.poItem} />
              </TableCell>
              <TableCell className="text-right text-foreground">
                <div className="flex flex-col items-end gap-0.5">
                  <span>{formatCount(row.receivedQuantity)}</span>
                  {row.deliveryCount > 1 && (
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatCount(row.deliveryCount)} deliveries
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-foreground">{formatCount(row.issuedQuantity)}</TableCell>
              <TableCell className="text-right font-semibold text-foreground">
                {formatCount(row.outstandingQuantity)}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatApiDate(row.lastGrDate)}</TableCell>
              <TableCell className="text-right">
                <StatusPill tone={row.daysSinceGr >= row.thresholdDays * 3 ? "urgent" : "caution"}>
                  {formatCount(row.daysSinceGr)} days
                </StatusPill>
              </TableCell>
              <IssuedOnCell
                firstDate={row.firstIssueDate}
                lastDate={row.lastIssueDate}
                received={row.receivedQuantity > 0}
                issueMatch={row.issueMatch}
              />
              <NextPlannedIssueCell
                date={row.nextPlannedIssueDate}
                quantity={row.nextPlannedIssueQuantity}
                inStock={row.outstandingQuantity > 0}
              />
              <TableCell>
                {row.issueMatch && (
                  <span
                    className="cursor-help text-xs whitespace-nowrap text-muted-foreground underline decoration-dotted underline-offset-2"
                    title={ISSUE_MATCH_EXPLANATIONS[row.issueMatch]}
                  >
                    {ISSUE_MATCH_LABELS[row.issueMatch]}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  )
}
