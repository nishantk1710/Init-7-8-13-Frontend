import Link from "next/link"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import type { GlobalAction } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const SEVERITY_ICON = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleAlert,
} as const

const SEVERITY_CLASS = {
  info: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const

const INITIATIVE_LABEL: Record<GlobalAction["initiative"], string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

export function AttentionRequiredPanel({ actions }: { actions: GlobalAction[] }) {
  return (
    <ChartCard
      title="Priority Actions"
      subtitle="What needs a decision right now — click through to act on it."
    >
      {actions.length === 0 ? (
        <EmptyState title="Nothing needs attention right now" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {actions.slice(0, 10).map((action) => {
            const Icon = SEVERITY_ICON[action.severity]
            return (
              <li key={action.id}>
                <Link
                  href={action.href}
                  className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40"
                >
                  <Icon className={cn("size-4 shrink-0", SEVERITY_CLASS[action.severity])} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{action.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {INITIATIVE_LABEL[action.initiative]} · {action.createdAt}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ChartCard>
  )
}
