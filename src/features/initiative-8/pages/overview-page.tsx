import { PageHeader } from "@/components/shared/page-header"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { RepairAgingChart } from "@/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairStatusChart } from "@/features/initiative-8/components/repair-status-chart"
import { RepairsByVendorChart } from "@/features/initiative-8/components/repairs-by-vendor-chart"
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"

export function RefurbishableSparesOverviewPage() {
  const materialsMonitored = REPAIR_CHAINS.length
  const qtyUnderRepair = REPAIR_CHAINS.reduce((sum, c) => sum + c.qtyUnderRepair, 0)
  const activeChains = REPAIR_CHAINS.filter((c) => c.repairStatus !== "Closed").length
  const duplicateAlerts = DECLARATIONS.filter((d) => d.status === "Flagged").length
  const pendingDeclarations = DECLARATIONS.filter(
    (d) => d.status === "Required" || d.status === "Pending"
  ).length
  const overdue = REPAIR_CHAINS.filter(
    (c) => c.repairStatus !== "Closed" && c.daysRemainingInRepair < 0
  ).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Repairable Spares"
          description="Repair-chain visibility and duplicate-procurement guarding for repairable spares."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPIStatCard label="Repairable materials monitored" value={materialsMonitored} />
          <KPIStatCard label="Qty currently under repair" value={qtyUnderRepair} hint="units at vendor" />
          <KPIStatCard label="Active repair chains" value={activeChains} />
          <KPIStatCard
            label="Duplicate procurement alerts"
            value={duplicateAlerts}
            trend={duplicateAlerts > 0 ? "down" : "flat"}
            trendLabel={duplicateAlerts > 0 ? "Flagged" : undefined}
          />
          <KPIStatCard
            label="Pending declarations"
            value={pendingDeclarations}
            hint="Required + Pending"
          />
          <KPIStatCard
            label="Repairs overdue"
            value={overdue}
            trend={overdue > 0 ? "down" : "flat"}
            trendLabel={overdue > 0 ? "Past expected return" : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Repair status distribution"
            subtitle="All repair chains, by current lifecycle stage"
            span={6}
          >
            <RepairStatusChart chains={REPAIR_CHAINS} />
          </ChartCard>
          <ChartCard
            title="Repairs by vendor"
            subtitle="Open repair chains, excluding closed"
            span={6}
          >
            <RepairsByVendorChart chains={REPAIR_CHAINS} />
          </ChartCard>
          <ChartCard
            title="Repair aging"
            subtitle="Days open for every active repair chain"
            span={6}
          >
            <RepairAgingChart chains={REPAIR_CHAINS} />
          </ChartCard>
          <ChartCard
            title="Repairable stock by plant"
            subtitle="Stock on hand for monitored repairable materials"
            span={6}
          >
            <RepairableStockByPlantChart chains={REPAIR_CHAINS} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
