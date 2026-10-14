import { StatusBadge } from "@/components/shared/status-badge"
import { TableCell } from "@/components/ui/table"
import { formatApiDate } from "@/lib/api/format"
import type { DeliveryStatus } from "@/features/initiative-13/utils/delivery-status"
import { formatCount } from "@/lib/utils"

/**
 * The "Delivered on" cell: goods-receipt date with its status underneath, so a
 * partial delivery never shows as a bare date.
 */
export function DeliveredOnCell({
  status,
  receivedQuantity,
  orderedQuantity,
}: {
  status: DeliveryStatus
  receivedQuantity: number | null
  /** Shown as "5 of 10" when known; the lines view does not receive it. */
  orderedQuantity?: number | null
}) {
  if (status.state === "NO_PO") {
    return (
      <TableCell className="text-muted-foreground" title="No purchase order yet">
        —
      </TableCell>
    )
  }
  if (status.state === "NOT_DELIVERED") {
    return (
      <TableCell>
        <StatusBadge>Not delivered</StatusBadge>
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
        <span className="whitespace-nowrap text-foreground">{formatApiDate(status.date)}</span>
        {status.state === "DELIVERED" ? (
          <StatusBadge tone="success">Delivered</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Partially received · {partialDetail}</StatusBadge>
        )}
      </div>
    </TableCell>
  )
}
