import { formatMetric } from "@/components/home/initiative-summary-card"
import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { INITIATIVE_NAME } from "@/components/shared/load-status"
import type { InitiativeId, InitiativeSummary } from "@/lib/domain/contracts"
import type { Section } from "@/lib/domain/live-feed"

function MetricsList({ summary }: { summary: InitiativeSummary }) {
  if (summary.metrics.length === 0) {
    return <EmptyState title={`No ${summary.label} signals yet`} />
  }
  return (
    <dl className="grid grid-cols-2 gap-3">
      {summary.metrics.map((m) => (
        <div key={m.label}>
          <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
          <dd className="text-sm font-medium text-foreground">{formatMetric(m.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One module block in the signals panel: its metrics, or why it has none. */
function ModuleSignals({ id, section }: { id: InitiativeId; section: Section<InitiativeSummary> }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-foreground">{INITIATIVE_NAME[id]}</div>
      {section.status === "ready" ? (
        <MetricsList summary={section.data} />
      ) : (
        <p role="alert" className="text-xs text-destructive">
          Could not be loaded: {section.message}
        </p>
      )}
    </div>
  )
}

export function MaterialRiskLandscape({
  initiative8,
  initiative13,
}: {
  initiative8: Section<InitiativeSummary>
  initiative13: Section<InitiativeSummary>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Inventory risk" subtitle="Lowest stock-on-hand materials in the shared catalog.">
        {/* No backend route ranks stock on hand across the catalogue yet: the
            figures exist in I07 staged stock but nothing serves them. The panel
            used to rank a hand-written sample, which looked exactly like real
            data. It says what is missing instead. */}
        <EmptyState
          title="Not available yet"
          description="No backend route serves the lowest stock-on-hand across the catalogue, so nothing is ranked here rather than showing sample figures."
        />
      </ChartCard>

      <ChartCard
        title="Utilization / repair signals"
        subtitle="Repairable Spares and OAR Utilization at a glance."
      >
        <div className="flex flex-col gap-4">
          <ModuleSignals id="initiative-8" section={initiative8} />
          <div className="border-t border-dashed border-border pt-3">
            <ModuleSignals id="initiative-13" section={initiative13} />
          </div>
        </div>
      </ChartCard>
    </div>
  )
}
