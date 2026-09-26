import { PageHeader } from "@demo/components/shared/page-header"
import { QuarterlyReportsDemoWorkspace } from "@demo/features/initiative-7/components/quarterly-reports-workspace"

export function InventoryReportsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Quarterly Reports"
          description="The I07 Quarterly Deep-Dive Report — scope, forecasting, stock parameters, recommendations and approval status for one quarter"
        />
        <QuarterlyReportsDemoWorkspace />
      </div>
    </div>
  )
}
