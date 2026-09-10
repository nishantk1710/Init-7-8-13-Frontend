import { PageHeader } from "@/components/shared/page-header"
import { DeclarationQueueTable } from "@/features/initiative-8/components/declaration-queue-table"

export function DeclarationQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Declaration Queue"
          description="Condition-to-repair declarations — mandatory, and tracked separately from Duplicate Guard."
        />
        <DeclarationQueueTable />
      </div>
    </div>
  )
}
