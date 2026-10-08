import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { ChartCard } from "@demo/components/shared/chart-card"
import { KPIStatCard } from "@demo/components/shared/kpi-stat-card"
import { PageHeader } from "@demo/components/shared/page-header"
import { buttonVariants } from "@demo/components/ui/button"
import { RepairAgingChart } from "@demo/features/initiative-8/components/repair-aging-chart"
import { RepairableStockByPlantChart } from "@demo/features/initiative-8/components/repairable-stock-by-plant-chart"
import { RepairStatusChart } from "@demo/features/initiative-8/components/repair-status-chart"
import { RepairsByVendorChart } from "@demo/features/initiative-8/components/repairs-by-vendor-chart"
import { DECLARATIONS } from "@demo/features/initiative-8/data/declarations"
import { EXCEPTIONS } from "@demo/features/initiative-8/data/exceptions"
import { REFERENCE_DATE, REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  isOpenRepair,
  isRepairOverdue,
  overdueStatusOf,
} from "@demo/features/initiative-8/utils/status"
import { formatCount } from "@demo/lib/utils"

const DESCRIPTION =
  "Repair register, condition attestation and reservation-time compliance for 80-series spares."

/** Open repair lines per vendor — a count, not a turnaround. */
function openLinesByVendor(chains: RepairChain[], limit = 10) {
  const byVendor = new Map<string, number>()
  for (const chain of chains) {
    if (!isOpenRepair(chain)) continue
    byVendor.set(chain.vendor, (byVendor.get(chain.vendor) ?? 0) + 1)
  }
  const ranked = [...byVendor]
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor))
  return {
    top: ranked.slice(0, limit),
    vendorCount: ranked.length,
    otherLines: ranked.slice(limit).reduce((sum, v) => sum + v.count, 0),
  }
}

export function RefurbishableSparesOverviewPage() {
  const totalLines = REPAIR_CHAINS.length
  const openLines = REPAIR_CHAINS.filter(isOpenRepair).length
  const overdueLines = REPAIR_CHAINS.filter(isRepairOverdue).length
  const noDueDateLines = REPAIR_CHAINS.filter((c) => overdueStatusOf(c) === "NO_DUE_DATE").length
  const materials = new Set(REPAIR_CHAINS.map((c) => c.material.materialId)).size
  const plants = new Set(REPAIR_CHAINS.map((c) => c.plant.plantId)).size
  const qtyUnderRepair = REPAIR_CHAINS.reduce((sum, c) => sum + c.qtyUnderRepair, 0)
  const vendors = openLinesByVendor(REPAIR_CHAINS)

  const outstandingDeclarations = DECLARATIONS.filter(
    (d) => d.status === "Required" || d.status === "Flagged"
  ).length

  const unjustified = EXCEPTIONS.filter((e) => e.type === "UNJUSTIFIED_ACQUISITION").length
  const actionableExceptions = EXCEPTIONS.filter((e) => !e.preAutomation).length
  const preAutomationExceptions = EXCEPTIONS.length - actionableExceptions

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Repairable Spares"
          description={`${DESCRIPTION} As at ${REFERENCE_DATE}.`}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPIStatCard
            label="Repairable materials monitored"
            value={formatCount(materials)}
            hint={`80-series, across ${plants} plants`}
          />
          <KPIStatCard
            label="Qty currently under repair"
            value={formatCount(qtyUnderRepair)}
            hint="units on open repair lines"
          />
          <KPIStatCard
            label="Open repair lines"
            value={formatCount(openLines)}
            hint={`of ${formatCount(totalLines)} in the register`}
          />
          <KPIStatCard
            label="Unjustified new purchases"
            value={formatCount(unjustified)}
            trend={unjustified ? "down" : "flat"}
            trendLabel={unjustified ? "Unjustified" : undefined}
            hint="new units bought while a repair was open"
          />
          <KPIStatCard
            label="Pending declarations"
            value={formatCount(outstandingDeclarations)}
            hint="Required + Flagged"
          />
          <KPIStatCard
            label="Repairs overdue"
            value={formatCount(overdueLines)}
            trend={overdueLines > 0 ? "down" : "flat"}
            trendLabel={overdueLines > 0 ? "Past promised return" : undefined}
            hint={`${overdueLines > 0 ? "· " : ""}${formatCount(noDueDateLines)} with no due date`}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Exception queue:{" "}
            <strong className="text-foreground">{formatCount(EXCEPTIONS.length)}</strong>{" "}
            exceptions, <strong className="text-foreground">{formatCount(actionableExceptions)}</strong>{" "}
            actionable, {formatCount(preAutomationExceptions)} raised before Spares Automation.
          </p>
          <Link
            href="/repairable-spares/exceptions"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open exception queue
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Repair status distribution"
            subtitle={`All ${formatCount(totalLines)} repair lines, by current lifecycle stage`}
            span={6}
          >
            <RepairStatusChart chains={REPAIR_CHAINS} />
          </ChartCard>
          <ChartCard
            title="Repairs by vendor"
            subtitle={
              vendors.vendorCount > vendors.top.length
                ? `Open repair lines — top ${vendors.top.length} of ${vendors.vendorCount} vendors`
                : "Open repair lines per vendor"
            }
            footnote={
              <>
                A count of open lines, not a turnaround.
                {vendors.otherLines > 0 &&
                  ` The other ${vendors.vendorCount - vendors.top.length} vendors hold ${formatCount(vendors.otherLines)} open lines.`}
              </>
            }
            span={6}
          >
            <RepairsByVendorChart data={vendors.top} />
          </ChartCard>
          <ChartCard
            title="Repair aging"
            subtitle={`Days open for the ${formatCount(openLines)} open repair lines`}
            span={6}
          >
            <RepairAgingChart chains={REPAIR_CHAINS} />
          </ChartCard>
          <ChartCard
            title="Repairable stock by plant"
            subtitle="Stock on hand across the repairable materials (every material and plant)"
            span={6}
          >
            <RepairableStockByPlantChart chains={REPAIR_CHAINS} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
