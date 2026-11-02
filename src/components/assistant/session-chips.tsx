import { SESSION_OUTCOME_LABEL, type SessionOutcome } from "@/lib/assistant/session-outcome"
import type { Tone } from "@/lib/assistant/session-view"
import { cn } from "@/lib/utils"

/**
 * The session screens' pills, in one place so the list and the session page
 * colour an outcome the same way. Presentation only.
 */

export const OUTCOME_TONE: Record<SessionOutcome, Tone | "urgent"> = {
  followed: "healthy",
  "went-ahead": "caution",
  "not-acted": "urgent",
  open: "muted",
}

const PILL: Record<Tone | "urgent", string> = {
  action: "bg-action/10 text-action",
  healthy: "bg-success/10 text-success",
  caution: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
  urgent: "bg-destructive/10 text-destructive",
}

/** A dot and a few words on a tinted pill, the request screens' style. */
export function TonePill({
  tone,
  children,
  className,
  title,
}: {
  tone: Tone | "urgent"
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        PILL[tone],
        className
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}

/** What came of a session: followed, went ahead anyway, not acted on, still open. */
export function OutcomeChip({ outcome, className }: { outcome: SessionOutcome; className?: string }) {
  return (
    <TonePill tone={OUTCOME_TONE[outcome]} className={className}>
      {SESSION_OUTCOME_LABEL[outcome]}
    </TonePill>
  )
}
