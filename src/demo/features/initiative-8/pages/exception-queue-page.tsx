import { PageHeader } from "@demo/components/shared/page-header"
import { ExceptionQueueTable } from "@demo/features/initiative-8/components/exception-queue-table"

export function ExceptionQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader
          title="Exception Queue"
          description="Repair lines sent out with no condition declaration, and new units bought while a repair was open with no justification on record."
        />
        <ExceptionQueueTable />
      </div>
    </div>
  )
}
