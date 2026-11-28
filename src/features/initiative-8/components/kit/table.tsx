import type { ReactNode } from "react"

import { TableCell, TableHead } from "@/components/ui/table"
import { I08_COLUMN_SOURCES, type I08ColumnSource } from "@/features/initiative-8/data/column-sources"
import { cn } from "@/lib/utils"

/** The hover text: the column's own note, when it has one, then where its value comes from. */
export function columnTitle(source: I08ColumnSource, note?: string): string {
  return note ? `${note}\n\n${I08_COLUMN_SOURCES[source]}` : I08_COLUMN_SOURCES[source]
}

/**
 * The header and body cells of every I08 table: 14px text, a quiet header,
 * room to breathe. `frozen` marks the Material column that stays put while the
 * rest scroll sideways (StickyScrollTable); the I08 look paints it the card's
 * colour so nothing shows through it.
 *
 * `source` says, on hover, which SAP table and field the column shows
 * (`data/column-sources.ts`), with a dotted underline to mark it hoverable.
 * A heading that owns a tooltip already -- a sort button, an InfoPopover --
 * takes `columnTitle` itself and puts the text on that control, so one cell
 * never offers two different tooltips.
 */
export function I08Head({
  children,
  right,
  frozen,
  sort,
  wrap,
  source,
}: {
  children?: ReactNode
  right?: boolean
  frozen?: boolean
  /** For a sortable column: its order, as `aria-sort` on the header cell. */
  sort?: "ascending" | "descending" | "none"
  /** A two-word header in a narrow column wraps onto two lines rather than
   *  running into the next one. */
  wrap?: boolean
  /** Where this column's value comes from. Left out only on a heading that is
   *  not a column of data -- a rank, a legend -- or one carrying its own
   *  control, which shows the source itself. */
  source?: I08ColumnSource
}) {
  return (
    <TableHead
      aria-sort={sort}
      data-frozen-column={frozen || undefined}
      title={source ? columnTitle(source) : undefined}
      className={cn(
        "h-[42px] bg-(--i08-head) px-3 text-[13px] font-medium text-muted-foreground",
        right && "text-right",
        wrap && "leading-tight whitespace-normal",
      )}
    >
      {source ? (
        <span className="cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-4">
          {children}
        </span>
      ) : (
        children
      )}
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
