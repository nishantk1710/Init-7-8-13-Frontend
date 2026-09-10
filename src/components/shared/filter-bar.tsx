import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Layout-only wrapper for a row of filter controls (Selects, search inputs) —
 * each module builds its own filter controls and just lays them out here, so
 * every table page gets the same responsive filter-row spacing.
 */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {children}
    </div>
  )
}
