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
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        TONE_TINT[tone],
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_FILL[tone])} />
      {children}
    </span>
  )
}
