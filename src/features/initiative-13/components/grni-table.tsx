"use client"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
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
    <div className="overflow-x-auto rounded-xl border border-border">
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
                  <span>{row.material}</span>
                  <AskAssistantLink materialId={row.material} plant={row.plant} variant="chip" label="Ask" />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.plant}</TableCell>
              <TableCell>
                <SAPDocumentChip
                  doc={{
                    type: "RESERVATION",
                    documentNumber: row.reservationNumber,
                    line: row.reservationItem || undefined,
                  }}
                />
              </TableCell>
              <TableCell>
                {row.poNumber ? (
                  <SAPDocumentChip
                    doc={{ type: "PO", documentNumber: row.poNumber, line: row.poItem ?? undefined }}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-foreground">{formatCount(row.receivedQuantity)}</TableCell>
              <TableCell className="text-right text-foreground">{formatCount(row.issuedQuantity)}</TableCell>
              <TableCell className="text-right font-semibold text-foreground">
                {formatCount(row.outstandingQuantity)}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatApiDate(row.lastGrDate)}</TableCell>
              <TableCell className="text-right">
                <StatusBadge tone={row.daysSinceGr >= row.thresholdDays * 3 ? "danger" : "warning"}>
                  {formatCount(row.daysSinceGr)} days
                </StatusBadge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatApiDate(row.requirementDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
