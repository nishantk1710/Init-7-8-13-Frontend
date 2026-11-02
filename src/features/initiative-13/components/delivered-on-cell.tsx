import type { ReactNode } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { TableCell } from "@/components/ui/table"
import { formatApiDate } from "@/lib/api/format"
import {
  DELIVERY_STATE_EXPLANATIONS,
  DELIVERY_STATE_LABELS,
  type DeliveryStatus,
} from "@/features/initiative-13/utils/delivery-status"
import { cn, formatCount } from "@/lib/utils"

/** Hover text naming the SAP field, so the cell itself can stay short. */
const EXPECTED_TITLE = "Expected delivery date (EKET-EINDT): the PO line's next schedule line still to deliver"

/** "Expected 25 Oct 2026" (or "Next expected …"), red once the date has passed. */
function ExpectedLine({ date, overdue, prefix }: { date: string; overdue: boolean; prefix: string }) {
  return (
    <span
      className={cn("whitespace-nowrap text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}
      title={`${EXPECTED_TITLE}${overdue ? " -- this date has passed" : ""}`}
    >
      {prefix} {formatApiDate(date)}
    </span>
  )
}

/**
 * The "Delivered on" cell: goods-receipt date (EKBE-BUDAT) with its status
 * underneath, so a partial delivery never shows as a bare date. A line not
 * (fully) delivered also says when the rest is expected (EKET-EINDT), in red
 * with an Overdue badge once that date has passed. A line nothing more will
 * arrive on (closed in SAP, or not an order) says so, never "Not delivered".
 */
export function DeliveredOnCell({
  status,
  receivedQuantity,
  orderedQuantity,
  lead,
}: {
  status: DeliveryStatus
  receivedQuantity: number | null
  /** Shown as "5 of 10" when known; the lines view does not receive it. */
  orderedQuantity?: number | null
  /** Drawn above the date -- the received quantity, where the table folds it into this cell. */
  lead?: ReactNode
}) {
  if (status.state === "NO_PO") {
    return (
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          {lead}
          <EmptyValue kind="noPoYet" />
        </div>
      </TableCell>
    )
  }
  if (status.state === "CLOSED" || status.state === "NOT_AN_ORDER") {
    const received = receivedQuantity ?? 0
    return (
      <TableCell title={DELIVERY_STATE_EXPLANATIONS[status.state]}>
        <div className="flex flex-col items-start gap-1">
          {lead}
          {received > 0 && status.date && (
            <span className="whitespace-nowrap text-foreground">{formatApiDate(status.date)}</span>
          )}
          <StatusBadge>
            {DELIVERY_STATE_LABELS[status.state]}
            {received > 0 ? ` · ${formatCount(received)} received` : ""}
          </StatusBadge>
        </div>
      </TableCell>
    )
  }
  if (status.state === "NOT_DELIVERED") {
    return (
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          {lead}
          {status.expectedDate ? (
            <ExpectedLine date={status.expectedDate} overdue={status.overdue} prefix="Expected" />
          ) : (
            <span className="text-xs text-muted-foreground" title={EXPECTED_TITLE}>
              No expected date in SAP
            </span>
          )}
          {status.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : <StatusBadge>Not delivered</StatusBadge>}
        </div>
      </TableCell>
    )
  }

  const several = status.firstDate && status.date && status.firstDate !== status.date
  const title = several
    ? `First received ${formatApiDate(status.firstDate)}, latest ${formatApiDate(status.date)}`
    : `Received ${formatApiDate(status.date)}`
  const received = receivedQuantity ?? 0
  const partialDetail = orderedQuantity
    ? `${formatCount(received)} of ${formatCount(orderedQuantity)}`
    : `${formatCount(received)} received`

  return (
    <TableCell title={title}>
      <div className="flex flex-col items-start gap-1">
        {lead}
        <span className="whitespace-nowrap text-foreground">{formatApiDate(status.date)}</span>
        {status.state === "DELIVERED" ? (
          <StatusBadge tone="success">Delivered</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Partially received · {partialDetail}</StatusBadge>
        )}
        {status.state === "PARTIAL" && status.expectedDate && (
          <ExpectedLine
            date={status.expectedDate}
            overdue={status.overdue}
            prefix={status.overdue ? "Overdue · next expected" : "Next expected"}
          />
        )}
      </div>
    </TableCell>
  )
}
