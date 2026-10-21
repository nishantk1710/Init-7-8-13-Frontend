"use client"

import { X } from "lucide-react"

import { Button } from "@demo/components/ui/button"
import { cn } from "@demo/lib/utils"

/**
 * Resets every filter in a filter row at once. Renders nothing while no filter
 * is active, so it only appears when there is something to clear.
 */
export function ClearFiltersButton({
  activeCount,
  onClear,
  className,
}: {
  /** How many filters are currently narrowing the view. */
  activeCount: number
  onClear: () => void
  className?: string
}) {
  if (activeCount === 0) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClear}
      className={cn("h-9 gap-1.5 text-muted-foreground hover:text-foreground", className)}
    >
      <X className="size-3.5" />
      Clear filters
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground">
        {activeCount}
      </span>
    </Button>
  )
}
