import { PageHeader } from "@demo/components/shared/page-header"
import { JustificationLog } from "@demo/features/initiative-8/components/justification-log"

export function JustificationsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader
          title="New-acquisition justifications"
          description="Why a new unit was bought while a repairable one already existed — captured at the moment of the reservation."
        />
        <JustificationLog />
      </div>
    </div>
  )
}
