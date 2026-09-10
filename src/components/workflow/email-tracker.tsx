import { Clock, Mail, TriangleAlert, type LucideIcon } from "lucide-react"

import type { EmailNotificationData, EmailStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<EmailStatus, LucideIcon> = {
  sent: Mail,
  pending: Clock,
  escalated: TriangleAlert,
}

const TONE_CLASSES: Record<EmailStatus, string> = {
  sent: "bg-accent text-accent-foreground",
  pending: "bg-warning/15 text-warning",
  escalated: "bg-destructive/10 text-destructive",
}

export function EmailTracker({ items }: { items: EmailNotificationData[] }) {
  return (
    <div className="p-3">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
        Email notifications
      </h3>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const Icon = ICONS[item.status]
          return (
            <div key={item.id} className="flex items-start gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  TONE_CLASSES[item.status]
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div>
                <div className="text-xs leading-snug text-foreground">
                  {item.text}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {item.time}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
