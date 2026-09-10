import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { RecommendationsWorkspace } from "@/features/initiative-7/components/recommendations-workspace"

export function RecommendationsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Recommendations"
          description="ROP, safety-stock and max-stock recommendations across the spares catalog."
        />
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading recommendations…</div>}>
          <RecommendationsWorkspace />
        </Suspense>
      </div>
    </div>
  )
}
