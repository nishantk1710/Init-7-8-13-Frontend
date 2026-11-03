import { ActionCenterView } from "@/components/action-center/action-center-view"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"

export function ActionCenterPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Action Center"
          description="Every open item in Inventory Planning waiting on a decision."
          actions={<ProfileMenu />}
        />
        <ActionCenterView />
      </div>
    </div>
  )
}
