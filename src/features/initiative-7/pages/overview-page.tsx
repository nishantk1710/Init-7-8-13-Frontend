import { PageHeader } from "@/components/shared/page-header"
import { InventoryOptimizationOverviewWorkspace } from "@/features/initiative-7/components/overview-workspace"

export function InventoryOptimizationOverviewPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Inventory Planning"
          description="Criticality-aware ROP, safety-stock and max-stock recommendations."
        />

        <InventoryOptimizationOverviewWorkspace />
      </div>
    </div>
  )
}
