"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { useMaterial360 } from "@/lib/material-360-context"
import type { Material } from "@/lib/types"

export function LowStockList({ materials }: { materials: Material[] }) {
  const { openMaterial360 } = useMaterial360()

  if (materials.length === 0) {
    return <EmptyState title="No low-stock materials" />
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <MaterialIdentity
            material={{ materialId: m.id, materialCode: m.id, description: m.description }}
            onOpen={openMaterial360}
          />
          <span className="shrink-0 text-xs font-medium text-foreground">
            {m.stockLevel} on hand
          </span>
        </li>
      ))}
    </ul>
  )
}
