import type { ReactNode } from "react"
import { Bot } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Small visual pieces shared across the reservation assistant's screens.
 * Presentation only — nothing here reads or changes conversation state.
 */

/** Classes for the assistant's primary call to action. */
export const AI_BUTTON =
  "ai-gradient border-0 text-white shadow-md shadow-ai-1/25 transition-[transform,box-shadow,filter] hover:brightness-110 hover:shadow-lg hover:shadow-ai-2/30 active:scale-[0.98] disabled:opacity-60"

/** The assistant's avatar: a gradient orb that pulses while it is thinking. */
export function AiOrb({
  thinking = false,
  size = "md",
  className,
}: {
  thinking?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const dims = { sm: "size-6", md: "size-8", lg: "size-12" }[size]
  const icon = { sm: "size-3.5", md: "size-4", lg: "size-6" }[size]
  return (
    <span
      aria-hidden
      className={cn(
        "ai-gradient relative inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-md shadow-ai-2/30",
        thinking && "animate-ai-orb",
        dims,
        className
      )}
    >
      <Bot className={icon} />
      <span className="absolute inset-0 rounded-full ring-1 ring-white/30 ring-inset" />
    </span>
  )
}

/** A rounded icon tile in the assistant's accent, for headers and feature tiles. */
export function AiIconBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ai-1/15 via-ai-2/15 to-ai-3/15 text-ai-2 ring-1 ring-ai-2/20",
        className
      )}
    >
      {children}
    </span>
  )
}

/** Small uppercase label with a gradient dot, used as a section eyebrow. */
export function AiEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase",
        className
      )}
    >
      <span aria-hidden className="ai-gradient size-1.5 rounded-full" />
      {children}
    </span>
  )
}

/**
 * `PageHeader` for the assistant's screens: same props and layout, with the
 * assistant's avatar and accent.
 */
export function AssistantPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <AiOrb size="md" className="mt-1" />
        <div>
          <AiEyebrow>Reservation assistant</AiEyebrow>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
