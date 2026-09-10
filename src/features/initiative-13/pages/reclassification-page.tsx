import { PageHeader } from "@/components/shared/page-header"
import { ReclassificationTable } from "@/features/initiative-13/components/reclassification-table"
import { RECLASSIFICATION_CANDIDATES } from "@/features/initiative-13/data/reclassification"

export function ReclassificationPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Reclassification Candidates"
          description="OAR materials consumed frequently enough to warrant review as a stocked material."
        />
        <ReclassificationTable candidates={RECLASSIFICATION_CANDIDATES} />
      </div>
    </div>
  )
}
