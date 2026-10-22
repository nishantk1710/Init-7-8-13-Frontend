import type { ReactNode } from "react"

import { TableCell, TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * The header and body cells of every I08 table: 14px text, a quiet header,
 * room to breathe. `frozen` marks the Material column that stays put while the
 * rest scroll sideways (StickyScrollTable); the I08 look paints it the card's
 * colour so nothing shows through it.
 */
export function I08Head({ children, right, frozen }: { children?: ReactNode; right?: boolean; frozen?: boolean }) {
  return (
    <TableHead
      data-frozen-column={frozen || undefined}
      className={cn(
        "h-[42px] bg-(--i08-head) px-3 text-[13px] font-medium text-muted-foreground",
        right && "text-right",
      )}
    >
      {children}
    </TableHead>
  )
}

export function I08Cell({
  children,
  right,
  frozen,
  wrap,
  className,
}: {
  children?: ReactNode
  right?: boolean
  frozen?: boolean
  /** Let the text wrap rather than end in "…". */
  wrap?: boolean
  className?: string
}) {
  return (
    <TableCell
      data-frozen-column={frozen || undefined}
      className={cn(
        "overflow-hidden px-3 py-2.5 text-[14px] text-ellipsis",
        right && "text-right tabular-nums",
        wrap && "whitespace-normal",
        className,
      )}
    >
      {children}
    </TableCell>
  )
}
