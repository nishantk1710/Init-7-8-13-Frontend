import { cn } from "@/lib/utils"

/**
 * A material as a name over its number, the way the Repairable Spares register
 * shows it. Where no source names the part, the number alone -- never an
 * invented name.
 */
export function MaterialName({
  material,
  description,
  className,
}: {
  material: string
  description?: string | null
  className?: string
}) {
  if (!description) {
    return <span className={cn("font-medium text-foreground", className)}>{material}</span>
  }
  return (
    <span className={cn("flex min-w-0 max-w-[240px] flex-col", className)}>
      <span className="truncate font-medium text-foreground" title={description}>
        {description}
      </span>
      <span className="text-[11px] text-muted-foreground">{material}</span>
    </span>
  )
}
