"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

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
import type { ReservationLedgerRow } from "@/lib/api/i13"
import { formatCount } from "@/lib/utils"

function qty(value: number | null): string {
  return value === null ? "—" : formatCount(value)
}

/**
 * One row per reservation item, and the assistant session its item text names.
 *
 * The **Session** column is the link FR-4 asks for: the requester typed the
 * session ID into the reservation's item text (SGTXT) in SAP, the extract
 * carried it here, and the backend matched it to a real session for the same
 * part. A reservation marked UAT exists only in the UAT overlay.
 */
export function ReservationLedgerTable({ rows }: { rows: ReservationLedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reservations match these filters."
        description="A reservation raised in SAP appears here once a SAP extract carrying it is loaded."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reservation</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Required</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>PR / PO</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Issued</TableHead>
            <TableHead>Lifecycle</TableHead>
            <TableHead>Session (item text)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ledgerId}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <SAPDocumentChip
                    doc={{ type: "RESERVATION", documentNumber: row.reservationNumber, line: row.reservationItem }}
                  />
                  {row.uatSimulated && <StatusBadge tone="warning">UAT</StatusBadge>}
                </div>
              </TableCell>
              <TableCell className="font-medium text-foreground">{row.material}</TableCell>
              <TableCell className="text-muted-foreground">{row.plant}</TableCell>
              <TableCell className="text-muted-foreground">{formatApiDate(row.requirementDate)}</TableCell>
              <TableCell className="text-right text-foreground">{qty(row.reservationQuantity)}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {row.prNumber && <SAPDocumentChip doc={{ type: "PR", documentNumber: row.prNumber }} />}
                  {row.poNumber && (
                    <SAPDocumentChip doc={{ type: "PO", documentNumber: row.poNumber, line: row.poItem ?? undefined }} />
                  )}
                  {!row.prNumber && !row.poNumber && <span className="text-muted-foreground">—</span>}
                </div>
              </TableCell>
              <TableCell className="text-right text-foreground">{qty(row.receivedQuantity)}</TableCell>
              <TableCell className="text-right text-foreground">{qty(row.issuedQuantity)}</TableCell>
              <TableCell>
                <StatusBadge>{row.lifecycleStatus.replaceAll("_", " ")}</StatusBadge>
              </TableCell>
              <TableCell>
                {row.sessionId ? (
                  <Link
                    href={`/assistant/sessions/${encodeURIComponent(row.sessionId)}`}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-primary underline-offset-4 hover:underline"
                  >
                    <MessagesSquare className="size-3" aria-hidden />
                    {row.sessionId}
                  </Link>
                ) : row.sgtxt ? (
                  <span className="text-[11px] text-muted-foreground" title="Item text with no recognisable session ID">
                    &ldquo;{row.sgtxt}&rdquo;
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No session</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
