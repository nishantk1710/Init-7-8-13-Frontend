import { PageHeader } from "@demo/components/shared/page-header"
import { AdoptionTrackingWorkspace } from "@demo/features/initiative-7/components/adoption-tracking-workspace"

export function AdoptionTrackingPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Adoption Tracking"
          description="Whether an approved recommendation's values were actually changed in SAP"
        />
        <AdoptionTrackingWorkspace />
      </div>
    </div>
  )
}
