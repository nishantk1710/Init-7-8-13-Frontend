import type { ReactNode } from "react"
import { Info, TriangleAlert, CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = "info" | "warning" | "critical"

const TONE_CONFIG: Record<Tone, { icon: typeof Info; classes: string }> = {
  info: { icon: Info, classes: "border-border bg-muted/40 text-foreground" },
  warning: { icon: TriangleAlert, classes: "border-warning/30 bg-warning/10 text-warning" },
  critical: {
    icon: CircleAlert,
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

/** Inline banner for advisory/blocking notices — e.g. Initiative 8's
 * Duplicate Guard warning, Initiative 13's overdue-consumption notice. */
export function AlertBanner({
  tone = "info",
  title,
  children,
  actions,
  className,
}: {
  tone?: Tone
  title: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const { icon: Icon, classes } = TONE_CONFIG[tone]
  return (
    <div className={cn("rounded-xl border p-3", classes, className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          {children && (
            <div className="mt-1 text-xs opacity-90 [&:not(:has(*))]:opacity-100">
              {children}
            </div>
          )}
          {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
