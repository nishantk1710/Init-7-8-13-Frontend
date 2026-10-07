import { PageHeader } from "@demo/components/shared/page-header"
import { ChartCard } from "@demo/components/shared/chart-card"
import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { RepairAgingChart } from "@demo/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@demo/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairStatusChart } from "@demo/features/initiative-8/components/repair-status-chart"
import { RepairsByVendorChart } from "@demo/features/initiative-8/components/repairs-by-vendor-chart"
import { CODING_CANDIDATES } from "@demo/features/initiative-8/data/coding-candidates"
import { DECLARATIONS } from "@demo/features/initiative-8/data/declarations"
import { EXCEPTIONS } from "@demo/features/initiative-8/data/exceptions"
import { JUSTIFICATIONS } from "@demo/features/initiative-8/data/justifications"
import { REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"

export function RefurbishableSparesOverviewPage() {
  const materialsMonitored = REPAIR_CHAINS.length
  const qtyUnderRepair = REPAIR_CHAINS.reduce((sum, c) => sum + c.qtyUnderRepair, 0)
  const activeChains = REPAIR_CHAINS.filter((c) => c.repairStatus !== "Closed").length
  const pendingDeclarations = DECLARATIONS.filter(
    (d) => d.status === "Required" || d.status === "Pending"
  ).length
  const overdue = REPAIR_CHAINS.filter(
    (c) => c.repairStatus !== "Closed" && c.daysRemainingInRepair < 0
  ).length

  // Both numbers, never one of them: the total is the business case and the
  // actionable count is the work, and either alone misleads in the opposite
  // direction. Lines raised before Spares Automation existed are a reason,
  // not a violation — nobody could have recorded anything against them.
  const openExceptions = EXCEPTIONS.length
  const actionableExceptions = EXCEPTIONS.filter((e) => !e.preAutomation).length

  // Advisory only. These are cases for a cataloguer to look at, not findings
  // that change any material's coding in SAP.
  const actionableCandidates = CODING_CANDIDATES.filter((c) => c.isActionable).length
  const corroboratedCandidates = CODING_CANDIDATES.filter((c) => c.isCorroborated).length

  const justifications = JUSTIFICATIONS.length
  const justifiedAtReservation = JUSTIFICATIONS.filter(
    (j) => j.source === "ASSISTANT"
  ).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Repairable Spares"
          description="Repair-chain visibility, condition declarations and new-acquisition control for 80-series spares."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KPIStatCard label="Repairable materials monitored" value={materialsMonitored} />
          <KPIStatCard
            label="Qty currently under repair"
            value={qtyUnderRepair}
            hint="units at vendor"
          />
          <KPIStatCard label="Active repair chains" value={activeChains} />
          <KPIStatCard
            label="Repairs overdue"
            value={overdue}
            trend={overdue > 0 ? "down" : "flat"}
            trendLabel={overdue > 0 ? "Past expected return" : undefined}
          />
          <KPIStatCard
            label="Pending declarations"
            value={pendingDeclarations}
            hint="Required + Pending"
          />
          <KPIStatCard
            label="Open exceptions"
            value={openExceptions}
            hint={`${actionableExceptions} actionable`}
            trend={actionableExceptions > 0 ? "down" : "flat"}
            trendLabel={actionableExceptions > 0 ? "Needs follow-up" : undefined}
          />
          <KPIStatCard
            label="Coding candidates"
            value={actionableCandidates}
            hint={`${corroboratedCandidates} corroborated by an 80-series twin`}
          />
          <KPIStatCard
            label="Acquisitions justified"
            value={justifications}
            hint={`${justifiedAtReservation} captured at reservation time`}
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
