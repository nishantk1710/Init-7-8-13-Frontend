import { notFound } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { MaterialOverviewContent } from "@/components/shared/material-overview-content"
import { getMaterialById } from "@/lib/shared-data/material-catalog"

/**
 * The shared material page (§32/§39) — one integrated view across every
 * module for a single material, so a user never has to jump between three
 * separate systems to understand one part.
 */
export function MaterialDetailPage({ materialId }: { materialId: string }) {
  const material = getMaterialById(materialId)
  if (!material) notFound()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <PageHeader title={material.description} description={materialId} />
        <MaterialOverviewContent materialId={materialId} />
      </div>
    </div>
  )
}
