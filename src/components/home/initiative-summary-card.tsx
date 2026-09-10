import Link from "next/link"
import { ArrowRight, CircleDot } from "lucide-react"

import type { InitiativeHealth, InitiativeSummary } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"

const HEALTH_CLASSES: Record<InitiativeHealth, string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
}

const HEALTH_LABELS: Record<InitiativeHealth, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
}

/** Pure rendering of one `InitiativeSummary` — no calculation happens here. */
export function InitiativeSummaryCard({ summary }: { summary: InitiativeSummary }) {
  return (
    <Link
      href={summary.href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{summary.label}</span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", HEALTH_CLASSES[summary.health])}>
        <CircleDot className="size-3" />
        {HEALTH_LABELS[summary.health]}
      </div>
      {summary.metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2">
          {summary.metrics.slice(0, 4).map((m) => (
            <div key={m.label}>
              <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
              <dd className="text-sm font-medium text-foreground">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[11px] text-muted-foreground">No metrics reported yet.</p>
      )}
      {summary.actions.length > 0 && (
        <div className="mt-auto border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          {summary.actions.length} item{summary.actions.length === 1 ? "" : "s"} need
          {summary.actions.length === 1 ? "s" : ""} attention
        </div>
      )}
    </Link>
  )
}
