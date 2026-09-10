import { ActionCenterTabs } from "@/components/action-center/action-center-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { getAllGlobalActions } from "@/lib/aggregation"

export function ActionCenterPage() {
  const actions = getAllGlobalActions()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Action Center"
          description="Every open item across inventory planning, repairable spares and OAR utilization."
        />
        <ActionCenterTabs actions={actions} />
      </div>
    </div>
  )
}
