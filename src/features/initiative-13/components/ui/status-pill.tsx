import type { ReactNode } from "react"

import { TONE_FILL, TONE_TINT } from "@/features/initiative-13/components/ui/tones"
import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { cn } from "@/lib/utils"

/**
 * A status in words on its tone's tint, with a dot of the solid colour. The
 * text always carries the meaning; the colour repeats it.
 */
export function StatusPill({
  tone,
  children,
  title,
  className,
}: {
  tone: DisplayTone
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        // Wraps only when its column is narrower than the label (fixed-layout tables), so a pill never spills
        // over the next column; at normal width it is the same single-line capsule.
        "inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-2xl px-2.5 py-0.5 text-xs leading-tight font-semibold",
        TONE_TINT[tone],
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_FILL[tone])} />
      {children}
    </span>
  )
}
