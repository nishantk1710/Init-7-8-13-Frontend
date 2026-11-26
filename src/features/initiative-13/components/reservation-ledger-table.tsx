"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { requiredBy } from "@/features/initiative-13/utils/required-by"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { issuedUnknownReason, lifecycleView } from "@/features/initiative-13/utils/reservation-lifecycle"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnHead } from "@/features/initiative-13/components/ui/column-head"
import { formatApiDate } from "@/lib/api/format"
import type { ReservationLedgerRow } from "@/lib/api/i13"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount, formatQuantity } from "@/lib/utils"

function qty(value: number | null) {
  return value === null ? <EmptyValue kind="notRecorded" /> : <span className="whitespace-nowrap tabular-nums">{formatQuantity(value)}</span>
}

/** The lifecycle view's own tones, in the pills' vocabulary. */
const LIFECYCLE_TONE: Record<"default" | "success" | "warning", DisplayTone> = {
  default: "primary",
  success: "healthy",
  warning: "caution",
}

/** The row's left edge, in its lifecycle pill's colour. */
const LIFECYCLE_EDGE: Record<"default" | "success" | "warning", string> = {
  default: "shadow-[inset_4px_0_0_var(--action)]",
  success: "shadow-[inset_4px_0_0_var(--healthy)]",
  warning: "shadow-[inset_4px_0_0_var(--caution)]",
}

/**
 * One row per reservation item, and the assistant session its item text names.
 * Drawn like the Procurement lines table: the same fitted frame, compact document numbers and status pills.
 *
 * No PR / PO or receipt columns: an OAR reservation is met from the store's
 * stock, and SAP links it to no purchase (RESB-BANFN is empty) -- the PR that
 * refills the shelf is raised by MRP for the material, not for this
 * reservation. Those columns were empty on nearly every row. The few
 * reservations that did raise their own PR show it under the Stage pill.
 *
 * The **Session** column is the link FR-4 asks for: the requester typed the
 * session ID into the reservation's item text (SGTXT) in SAP, the extract
 * carried it here, and the backend matched it to a real session for the same
 * part. A line of a multi-material request shows as `R.../n` (the request
 * reference the requester typed, and the line), not the line's internal
 * session ID. A reservation marked UAT exists only in the UAT overlay.
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
    <DataTable className={FITTED_TABLE} widths={[19, 10, 12, 8, 11, 14, 14, 12]} minWidth={1000}>
      <TableHeader>
        <TableRow>
          <ColumnHead source="material" className="w-[19%]">Material</ColumnHead>
          <ColumnHead source="reservation" className="w-[10%]">Reservation</ColumnHead>
          <ColumnHead
            source="requiredBy"
            note="When the part is needed: the requirement date typed in SAP if somebody typed one; otherwise the planned consumption window given in the assistant; otherwise Not recorded (raised directly in SAP, with SAP's pre-filled date left as it was)."
            className="w-[12%]"
          >
            Required by
          </ColumnHead>
          <ColumnHead source="reservedQty" className="w-[8%] text-right">Qty</ColumnHead>
          <ColumnHead
            source="issuedOnReservation"
            className="w-[11%] text-right"
            note="Quantity issued against this reservation (MSEG 201/261, less 202/262 reversals), with the latest issue date (MKPF-BUDAT)"
          >
            Issued
          </ColumnHead>
          <ColumnHead source="stage" note="How far the reservation has got: Reserved → PR raised → PO raised → Received → Issued" className="w-[14%] !pl-5">Stage</ColumnHead>
          <ColumnHead source="sessionItemText">Session (item text)</ColumnHead>
          <ColumnHead
            source="requester"
            note="Who the part was for, as typed in the assistant's Requester box. SAP holds no requester for a reservation."
          >
            Requester
          </ColumnHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.ledgerId}>
            <TableCell className={cn("text-foreground", LIFECYCLE_EDGE[lifecycleView(row.lifecycleStatus).tone])}>
              <div className="flex min-w-0 flex-col gap-0.5">
                {row.materialDescription ? (
                  <>
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]" title={row.materialDescription}>
                      {row.materialDescription}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{row.material}</span>
                  </>
                ) : (
                  <span className="font-medium">{row.material}</span>
                )}
                <span className="text-[11px] whitespace-nowrap text-muted-foreground">{sapPlantLabel(row.plant)}</span>
              </div>
            </TableCell>
            <TableCell>
              <DocNo number={row.reservationNumber} item={row.reservationItem} />
            </TableCell>
            <RequiredByCell row={row} />
            <TableCell className="text-right font-semibold text-foreground">{qty(row.reservationQuantity)}</TableCell>
            <IssuedCell row={row} />
            <TableCell className="!pl-5">
              <div className="flex flex-col items-start gap-1">
                <LifecyclePill status={row.lifecycleStatus} />
                <OwnProcurement row={row} />
              </div>
            </TableCell>
            <TableCell>
              {row.sessionId ? (
                <Link
                  href={`/assistant/sessions/${encodeURIComponent(row.sessionId)}`}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-action underline-offset-4 hover:underline"
                >
                  <MessagesSquare className="size-3" aria-hidden />
                  {row.sessionReference ?? row.sessionId}
                </Link>
              ) : row.sgtxt ? (
                <span
                  className="text-[11px] text-muted-foreground"
                  title="The reservation's item text (RESB-SGTXT), as typed in SAP. It names no session ID."
                >
                  Item text: &ldquo;{row.sgtxt}&rdquo;
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">No session</span>
              )}
            </TableCell>
            <TableCell className="whitespace-normal">
              <RequesterCell row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  )
}

/**
 * Required by -- when the part is needed (agreed with the user, 26 Nov 2026):
 *
 *   1. a requirement date somebody typed in SAP (RESB-BDTER different from the
 *      reservation's created date, RESB-CRDAT), for any reservation. SAP fills
 *      BDTER from the created date, so one equal to it was never typed -- on
 *      every assistant reservation on prod (25 Nov 2026), and about half of
 *      the rest. With no created date to compare (a reservation SAP made
 *      itself), it does not count;
 *   2. otherwise, made through the assistant: the planned consumption window
 *      the requester gave, or No plan recorded (a line marked not needed);
 *   3. otherwise, raised directly in SAP: Not recorded.
 */
function RequiredByCell({ row }: { row: ReservationLedgerRow }) {
  const shown = requiredBy(row)
  if (shown.kind === "sap") {
    return (
      <TableCell className="whitespace-nowrap text-muted-foreground" title="The requirement date in SAP (RESB-BDTER)">
        {shown.text}
      </TableCell>
    )
  }
  if (shown.kind === "plan") {
    return (
      <TableCell className="text-foreground" title="The planned consumption window given in the assistant">
        {shown.text}
      </TableCell>
    )
  }
  return (
    <TableCell>
      <span className="text-[11px] text-muted-foreground" title={shown.hint}>
        {shown.text}
      </span>
    </TableCell>
  )
}

/**
 * The requester: the name typed in the assistant for a reservation made through
 * it. A reservation raised directly in SAP (Non-AI) has none to show -- SAP
 * keeps no requester on a reservation, and RESB-WEMPF is the goods recipient
 * (often a system user or a role), not who asked -- so it reads as a placeholder.
 */
function RequesterCell({ row }: { row: ReservationLedgerRow }) {
  if (row.requesterName) {
    return <span className="text-[11px] text-foreground [overflow-wrap:anywhere]">{row.requesterName}</span>
  }
  if (row.sessionId) {
    return (
      <span className="text-[11px] text-muted-foreground" title="Made through the assistant, but no name was typed in its Requester box.">
        Not given
      </span>
    )
  }
  return (
    <span
      className="text-[11px] text-muted-foreground"
      title="Raised directly in SAP, without the assistant (Non-AI). SAP holds no requester for a reservation: RESB-WEMPF is the goods recipient, not who asked."
    >
      Non-AI: not recorded
    </span>
  )
}

/**
 * Issued, with the latest issue date underneath -- or "Before history" when it
 * cannot be known (the reservation predates the movement history). Exact: SAP
 * records every issue against its reservation (MSEG-RSNUM/RSPOS).
 */
function IssuedCell({ row }: { row: ReservationLedgerRow }) {
  const unknown = issuedUnknownReason(row)
  if (unknown) {
    return (
      <TableCell className="text-right">
        <EmptyValue kind="beforeHistory" title={unknown} />
      </TableCell>
    )
  }
  return (
    <TableCell className="text-right">
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-semibold tabular-nums text-foreground">{qty(row.issuedQuantity)}</span>
        {row.lastIssueDate ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{formatApiDate(row.lastIssueDate)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Not issued yet</span>
        )}
      </div>
    </TableCell>
  )
}

/**
 * The PR this reservation raised itself, its PO and what arrived on it --
 * only for the few that have one (RESB-BANFN filled). A stock reservation
 * shows nothing here: it never needed a purchase.
 */
function OwnProcurement({ row }: { row: ReservationLedgerRow }) {
  if (!row.prNumber && !row.poNumber) return null
  const received = row.receivedQuantity ?? 0
  return (
    <div className="flex flex-col items-start gap-0.5 text-[11px] text-muted-foreground">
      <span className="flex flex-wrap items-center gap-1">
        {row.prNumber && (
          <>
            PR <DocNo number={row.prNumber} />
          </>
        )}
        {row.poNumber && (
          <>
            PO <DocNo number={row.poNumber} item={row.poItem} />
          </>
        )}
      </span>
      {received > 0 && (
        <span className="whitespace-nowrap">
          {formatCount(received)} received{row.lastGrDate ? ` · ${formatApiDate(row.lastGrDate)}` : ""}
        </span>
      )}
    </div>
  )
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
