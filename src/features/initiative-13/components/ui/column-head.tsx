import type { ComponentProps } from "react"

import { TableHead } from "@/components/ui/table"
import { COLUMN_SOURCES, type ColumnSource } from "@/features/initiative-13/data/column-sources"

/** The hover text: the column's own note, when it has one, then where its value comes from. */
export function columnTitle(source: ColumnSource, note?: string): string {
  return note ? `${note}\n\n${COLUMN_SOURCES[source]}` : COLUMN_SOURCES[source]
}

/**
 * A table heading that says, on hover, which SAP table and field its column
 * shows (`data/column-sources.ts`). `note` keeps a column's own explanation,
 * shown first. A dotted underline marks it as hoverable.
 */
export function ColumnHead({
  source,
  note,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof TableHead>, "title"> & { source: ColumnSource; note?: string }) {
  return (
    <TableHead title={columnTitle(source, note)} className={className} {...props}>
      <span className="cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-4">
        {children}
      </span>
    </TableHead>
  )
}
