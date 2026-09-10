import { PageHeader } from "@/components/shared/page-header"
import { PipelineWorkspace } from "@/features/initiative-7/components/pipeline-workspace"

export function InventoryPipelinePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Pipeline"
          description="Where every recommendation sits right now, and what is not moving"
        />
        <PipelineWorkspace />
      </div>
    </div>
  )
}
