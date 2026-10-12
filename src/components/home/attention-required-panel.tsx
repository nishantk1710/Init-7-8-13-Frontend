import Link from "next/link"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { formatWhen } from "@/lib/api/format"
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

const SHOWN = 10

/**
 * `total` is the real number of open items, which can exceed the slice in
 * `actions`; when it does the footer says so rather than letting the list pass
 * for the whole picture.
 */
export function AttentionRequiredPanel({
  actions,
  total,
  failedModules = 0,
}: {
  actions: GlobalAction[]
  total?: number
  /** How many modules could not be loaded. An empty list is only "all clear" when this is 0. */
  failedModules?: number
}) {
  const hidden = (total ?? actions.length) - Math.min(actions.length, SHOWN)
  return (
    <ChartCard
      title="Priority Actions"
      subtitle="What needs a decision right now — click through to act on it."
    >
      {actions.length === 0 ? (
        failedModules > 0 ? (
          <EmptyState
            title="Nothing to show"
            description={`${failedModules} module${failedModules === 1 ? "" : "s"} could not be loaded, so this is not a statement that nothing needs attention.`}
          />
        ) : (
          <EmptyState title="Nothing needs attention right now" />
        )
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {actions.slice(0, SHOWN).map((action) => {
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
                        {INITIATIVE_LABEL[action.initiative]} · {formatWhen(action.createdAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          {hidden > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
              <span>
                Showing {Math.min(actions.length, SHOWN)} of {(total ?? actions.length).toLocaleString()}
              </span>
              <Link href="/actions" className="font-medium text-primary hover:underline">
                View all actions
              </Link>
            </div>
          )}
        </>
      )}
    </ChartCard>
  )
}
