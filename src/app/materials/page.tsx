import { Suspense } from "react"
import type { Metadata } from "next"

import { MaterialsExplorer } from "@/components/materials/materials-explorer"
import { Skeleton } from "@/components/ui/skeleton"
import { MATERIALS } from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Materials — Spares AI",
}

export default function MaterialsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Material search
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click a row to open a Spares Assistant conversation about that
            material — classification, routing and next steps.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-80 rounded-xl" />
            </div>
          }
        >
          <MaterialsExplorer materials={MATERIALS} />
        </Suspense>
      </div>
    </div>
  )
}
