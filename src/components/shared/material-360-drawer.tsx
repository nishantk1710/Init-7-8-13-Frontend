"use client"

import Link from "next/link"

import { DetailDrawer } from "@/components/shared/detail-drawer"
import { MaterialOverviewContent } from "@/components/shared/material-overview-content"
import { getMaterialById } from "@/lib/shared-data/material-catalog"
import { useMaterial360 } from "@/lib/material-360-context"

/**
 * Quick-glance overlay — same content as the `/materials/[materialId]` page
 * (via `MaterialOverviewContent`), for when a click-through shouldn't leave
 * the current screen.
 */
export function Material360Drawer() {
  const { openMaterialId, closeMaterial360 } = useMaterial360()
  const material = openMaterialId ? getMaterialById(openMaterialId) : undefined

  return (
    <DetailDrawer
      open={Boolean(openMaterialId)}
      onOpenChange={(open) => !open && closeMaterial360()}
      title={material ? material.description : (openMaterialId ?? "Material")}
      description={openMaterialId ?? undefined}
    >
      {openMaterialId && (
        <div className="flex flex-col gap-3">
          <MaterialOverviewContent materialId={openMaterialId} />
          <Link
            href={`/materials/${openMaterialId}`}
            className="text-[11px] text-primary hover:underline"
          >
            View full material page →
          </Link>
        </div>
      )}
    </DetailDrawer>
  )
}
