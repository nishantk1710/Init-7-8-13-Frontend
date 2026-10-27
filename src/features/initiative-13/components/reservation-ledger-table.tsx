"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { DeliveredOnCell } from "@/features/initiative-13/components/delivered-on-cell"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { deliveryStatus } from "@/features/initiative-13/utils/delivery-status"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { issuedUnknownReason, lifecycleView } from "@/features/initiative-13/utils/reservation-lifecycle"
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
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { formatCount } from "@/lib/utils"

function qty(value: number | null) {
  return value === null ? <EmptyValue kind="notRecorded" /> : formatCount(value)
}

/** The lifecycle view's own tones, in the pills' vocabulary. */
const LIFECYCLE_TONE: Record<"default" | "success" | "warning", DisplayTone> = {
  default: "primary",
  success: "healthy",
  warning: "caution",
}

/** The row's left edge, in its lifecycle pill's colour. */
const LIFECYCLE_EDGE: Record<"default" | "success" | "warning", string> = {
  default: "shadow-[inset_4px_0_0_var(--primary-strong)]",
  success: "shadow-[inset_4px_0_0_var(--healthy)]",
  warning: "shadow-[inset_4px_0_0_var(--caution)]",
}

/**
 * One row per reservation item, and the assistant session its item text names.
 * Drawn like the Procurement lines table: the same fitted frame, compact document numbers and status pills.
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
    <DataTable className={FITTED_TABLE}>
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
            <TableHead>Delivered on</TableHead>
            <TableHead className="text-right">Issued</TableHead>
            <TableHead>Lifecycle</TableHead>
            <TableHead>Session (item text)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ledgerId}>
              <TableCell className={LIFECYCLE_EDGE[lifecycleView(row.lifecycleStatus).tone]}>
                <DocNo number={row.reservationNumber} item={row.reservationItem} />
              </TableCell>
              <TableCell className="text-foreground">
                {row.materialDescription ? (
                  <div className="flex max-w-[200px] flex-col gap-0.5">
                    <span className="truncate font-semibold" title={row.materialDescription}>
                      {row.materialDescription}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{row.material}</span>
                  </div>
                ) : (
                  <span className="font-medium">{row.material}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
              <TableCell className="text-muted-foreground">{formatApiDate(row.requirementDate)}</TableCell>
              <TableCell className="text-right font-semibold text-foreground">{qty(row.reservationQuantity)}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  {row.prNumber && <DocNo number={row.prNumber} />}
                  {row.poNumber && <DocNo number={row.poNumber} item={row.poItem} />}
                  {!row.prNumber && !row.poNumber && <EmptyValue kind="noPrOrPo" />}
                </div>
              </TableCell>
              <TableCell className="text-right text-foreground">{qty(row.receivedQuantity)}</TableCell>
              <DeliveredOnCell
                status={deliveryStatus({
                  hasPo: Boolean(row.poNumber),
                  receivedQuantity: row.receivedQuantity,
                  orderedQuantity: row.orderedQuantity,
                  firstGrDate: row.firstGrDate,
                  latestGrDate: row.lastGrDate,
                  expectedDeliveryDate: row.expectedDeliveryDate,
                })}
                receivedQuantity={row.receivedQuantity}
                orderedQuantity={row.orderedQuantity}
              />
              <IssuedCell row={row} />
              <TableCell>
                <LifecyclePill status={row.lifecycleStatus} />
              </TableCell>
              <TableCell>
                {row.sessionId ? (
                  <Link
                    href={`/assistant/sessions/${encodeURIComponent(row.sessionId)}`}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-action underline-offset-4 hover:underline"
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
    </DataTable>
  )
}

/** Issued, or "Before history" when it cannot be known (the reservation predates the movement history). */
function IssuedCell({ row }: { row: ReservationLedgerRow }) {
  const unknown = issuedUnknownReason(row)
  if (unknown) {
    return (
      <TableCell className="text-right">
        <EmptyValue kind="beforeHistory" title={unknown} />
      </TableCell>
    )
  }
  return <TableCell className="text-right font-semibold text-foreground">{qty(row.issuedQuantity)}</TableCell>
}

/** The lifecycle as a label that never claims more than the data shows, explained on hover. */
function LifecyclePill({ status }: { status: string }) {
  const view = lifecycleView(status)
  return (
    <StatusPill
      tone={LIFECYCLE_TONE[view.tone]}
      title={view.explanation || undefined}
      className="h-auto py-0.5 leading-tight whitespace-normal"
    >
      {view.label}
    </StatusPill>
  )
}
