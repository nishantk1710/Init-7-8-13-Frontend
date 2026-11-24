"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnHead } from "@/features/initiative-13/components/ui/column-head"
import { formatApiDate } from "@/lib/api/format"
import type { GrniEntry } from "@/lib/api/i13"
import { formatCount, formatQuantity } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/**
 * Goods received 30+ days ago and not (fully) issued, one row per PO line.
 *
 * Only what SAP records against the PO line is shown: the goods receipt -- its
 * date and quantity -- and the days since. SAP posts a goods issue against the
 * material and the reservation, never against a PO, so how much of a line was
 * issued is not a fact SAP holds; it is not shown (UAT, 23-Nov-2026). Which
 * lines are listed still follows the backend's rule (the reservation's own
 * issues where a reservation raised the PR, else the material's issues counted
 * oldest delivery first), and the tab's (i) says so. The age is the days since
 * the line's last goods receipt, as of the backend snapshot's date.
 */
export function GrniTable({ rows }: { rows: GrniEntry[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing has been sitting unissued past the threshold."
        description="No PO line with these filters was received 30 or more days ago and left not, or only partly, issued."
      />
    )
  }

  return (
    <DataTable className={FITTED_TABLE} widths={[34, 14, 14, 14, 12, 12]} minWidth={760}>
      <TableHeader>
        <TableRow>
          <ColumnHead source="material">Material</ColumnHead>
          <ColumnHead source="plant">Plant</ColumnHead>
          <ColumnHead source="po">PO</ColumnHead>
          <ColumnHead
            source="lastGr"
            note="Date of the goods receipt on this PO line. If it was received in several deliveries, the latest one."
          >
            GR date
          </ColumnHead>
          <ColumnHead source="received" className="text-right" note="Quantity received on this PO line, reversals taken off">
            Received qty
          </ColumnHead>
          <ColumnHead source="daysSinceGr" className="text-right">Days since GR</ColumnHead>
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
            <TableCell className="text-foreground">
              <div className="flex flex-col items-start gap-0.5">
                <span className="whitespace-nowrap">{formatApiDate(row.lastGrDate)}</span>
                {row.deliveryCount > 1 && (
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    latest of {formatCount(row.deliveryCount)} deliveries
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right font-semibold text-foreground"><span className="whitespace-nowrap tabular-nums">{formatQuantity(row.receivedQuantity)}</span></TableCell>
            <TableCell className="text-right">
              <StatusPill tone={row.daysSinceGr >= row.thresholdDays * 3 ? "urgent" : "caution"}>
                {formatCount(row.daysSinceGr)} days
              </StatusPill>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  )
}
