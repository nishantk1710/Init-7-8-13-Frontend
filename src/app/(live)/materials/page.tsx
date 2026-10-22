import { Suspense } from "react"
import type { Metadata } from "next"

import { MaterialsExplorer } from "@/components/materials/materials-explorer"
import { PageLoader } from "@/components/shared/page-loader"
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
        <Suspense fallback={<PageLoader label="Loading materials" className="h-72 w-full" />}>
          <MaterialsExplorer materials={MATERIALS} />
        </Suspense>
      </div>
    </div>
  )
}
