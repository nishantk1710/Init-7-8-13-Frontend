import { cn } from "@/lib/utils"

/**
 * A SAP document number and item without the type label: the column header already says Reservation, PR or PO.
 * Short enough that three of them fit one table beside the quantities.
 */
export function DocNo({ number, item, className }: { number: string; item?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground",
        className
      )}
    >
      {number}
      {item && <span className="text-muted-foreground">/{item}</span>}
    </span>
  )
}
