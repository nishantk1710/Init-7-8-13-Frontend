"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
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
 * Goods received and not issued for 30+ days, one row per reservation line.
 *
 * The age is the days since the line's **last** goods receipt, measured as of
 * the backend snapshot's date — the same rule, and the same threshold, WATCH
 * applies per material and plant. Nothing here re-derives it.
 */
export function GrniTable({ rows }: { rows: GrniEntry[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing has been sitting unissued past the threshold."
        description="No reservation line with these filters was received and left unissued for 30 days or more."
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
            <TableHead>Reservation</TableHead>
            <TableHead>PO</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Issued</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Last GR</TableHead>
            <TableHead className="text-right">Days since GR</TableHead>
            <TableHead>Required by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ledgerId}>
              <TableCell className="font-medium text-foreground">
                <div className="flex flex-col gap-0.5">
                  <MaterialName material={row.material} description={row.materialDescription} />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
              <TableCell>
                <DocNo number={row.reservationNumber} item={row.reservationItem || undefined} />
              </TableCell>
              <TableCell>
                {row.poNumber ? (
                  <DocNo number={row.poNumber} item={row.poItem} />
                ) : (
                  <EmptyValue kind="noPoLinked" />
                )}
              </TableCell>
              <TableCell className="text-right text-foreground">{formatCount(row.receivedQuantity)}</TableCell>
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
              <TableCell className="text-muted-foreground">{formatApiDate(row.requirementDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  )
}
