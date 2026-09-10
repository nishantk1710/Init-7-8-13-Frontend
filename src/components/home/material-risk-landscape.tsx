import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { LowStockList } from "@/components/home/low-stock-list"
import type { InitiativeSummary } from "@/lib/domain/contracts"
import type { Material } from "@/lib/types"

function MetricsList({ summary }: { summary: InitiativeSummary }) {
  if (summary.metrics.length === 0) {
    return <EmptyState title={`No ${summary.label} signals yet`} />
  }
  return (
    <dl className="grid grid-cols-2 gap-3">
      {summary.metrics.map((m) => (
        <div key={m.label}>
          <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
          <dd className="text-sm font-medium text-foreground">{m.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function MaterialRiskLandscape({
  lowStockMaterials,
  initiative8Summary,
  initiative13Summary,
}: {
  lowStockMaterials: Material[]
  initiative8Summary: InitiativeSummary
  initiative13Summary: InitiativeSummary
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Inventory risk" subtitle="Lowest stock-on-hand materials in the shared catalog.">
        <LowStockList materials={lowStockMaterials} />
      </ChartCard>

      <ChartCard
        title="Utilization / repair signals"
        subtitle="Repairable Spares and OAR Utilization at a glance."
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-foreground">
              {initiative8Summary.label}
            </div>
            <MetricsList summary={initiative8Summary} />
          </div>
          <div className="border-t border-dashed border-border pt-3">
            <div className="mb-1.5 text-xs font-medium text-foreground">
              {initiative13Summary.label}
            </div>
            <MetricsList summary={initiative13Summary} />
          </div>
        </div>
      </ChartCard>
    </div>
  )
}
