import { AREA_FILL, APPROVALS_FILL } from "@/components/home/home-areas"
import { INITIATIVE_NAME } from "@/components/shared/load-status"
import type { InitiativeId } from "@/lib/domain/contracts"
import { cn, formatCount } from "@/lib/utils"

export type AreaCount = { id: InitiativeId; count: number }

/**
 * The headline: how many items need attention, split by area.
 *
 * Pending approvals are a subset of the areas' items (`decisions` is drawn
 * from `actions`), so they are stated beside the total -- "of which N wait for
 * a decision" -- and never added to it, which would count them twice.
 */
export function AttentionTotalCard({
  areas,
  decisionTotal,
  failedModules,
}: {
  /** Only the areas that answered. */
  areas: AreaCount[]
  decisionTotal: number
  failedModules: number
}) {
  const total = areas.reduce((sum, a) => sum + a.count, 0)
  const summary = areas.map((a) => `${INITIATIVE_NAME[a.id]}: ${formatCount(a.count)}`).join(", ")
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:gap-8">
      <div className="shrink-0">
        <p className="text-[30px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
          {formatCount(total)}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          items need attention across {areas.length} area{areas.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div
          role="img"
          aria-label={`Items needing attention by area. ${summary}`}
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {total > 0 &&
            areas
              .filter((a) => a.count > 0)
              .map((a) => (
                <div
                  key={a.id}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", AREA_FILL[a.id])}
                  style={{ width: `${(a.count / total) * 100}%` }}
                />
              ))}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {areas.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <span aria-hidden className={cn("size-2 rounded-full", AREA_FILL[a.id])} />
              <span className="text-foreground">{INITIATIVE_NAME[a.id]}</span>
              <span className="font-semibold text-muted-foreground tabular-nums">{formatCount(a.count)}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 rounded-full", APPROVALS_FILL)} />
            <span className="text-foreground">Of which waiting for a decision</span>
            <span className="font-semibold text-muted-foreground tabular-nums">{formatCount(decisionTotal)}</span>
          </li>
        </ul>
        {failedModules > 0 && (
          <p className="text-xs text-destructive">
            Excludes {failedModules} module{failedModules === 1 ? "" : "s"} that could not be loaded.
          </p>
        )}
      </div>
    </section>
  )
}
