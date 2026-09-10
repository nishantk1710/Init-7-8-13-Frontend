import { cn } from "@/lib/utils"

export interface TimelineEvent {
  id: string
  label: string
  timestamp: string
  description?: string
  tone?: "default" | "success" | "warning" | "danger"
}

const DOT_CLASSES: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

const STEP_DELAY_MS = 70
const CONNECTOR_DELAY_OFFSET_MS = 140

/**
 * Generic vertical event timeline — repair chains, RR->GI document flows,
 * aging-exception escalation paths all render through this one component.
 *
 * Pass `revealed` (typically the surrounding expand/collapse `isExpanded`
 * flag) to get a staggered, top-to-bottom reveal — each dot scales in, its
 * connector line grows downward, and its text slides/fades in — instead of
 * every step appearing at once. Omit it (default `true`) to render fully
 * settled on mount, which is exactly the old, unanimated behavior — existing
 * callers are unaffected unless they opt in.
 */
export function Timeline({
  events,
  className,
  revealed = true,
}: {
  events: TimelineEvent[]
  className?: string
  revealed?: boolean
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {events.map((event, index) => {
        const delay = revealed ? `${index * STEP_DELAY_MS}ms` : "0ms"
        const connectorDelay = revealed
          ? `${index * STEP_DELAY_MS + CONNECTOR_DELAY_OFFSET_MS}ms`
          : "0ms"

        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < events.length - 1 && (
              <span
                className={cn(
                  "absolute top-3 left-[5px] h-full w-px origin-top bg-border transition-transform duration-300 ease-out",
                  revealed ? "scale-y-100" : "scale-y-0"
                )}
                style={{ transitionDelay: connectorDelay }}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "mt-1 size-[11px] shrink-0 rounded-full ring-4 ring-card transition-transform duration-300 ease-out",
                DOT_CLASSES[event.tone ?? "default"],
                revealed ? "scale-100" : "scale-0"
              )}
              style={{ transitionDelay: delay }}
            />
            <div
              className={cn(
                "min-w-0 flex-1 transition-all duration-300 ease-out",
                revealed ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0"
              )}
              style={{ transitionDelay: delay }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{event.label}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {event.timestamp}
                </span>
              </div>
              {event.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {event.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
