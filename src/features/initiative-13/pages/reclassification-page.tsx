"use client"

import { useEffect, useState } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import { ReclassificationTable } from "@/features/initiative-13/components/reclassification-table"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { getI13Reclassification } from "@/features/initiative-13/api/client"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"

const FILTER_DEBOUNCE_MS = 400

export function ReclassificationPage() {
  const [plant, setPlant] = useState("")
  const [material, setMaterial] = useState("")
  const [plantQuery, setPlantQuery] = useState("")
  const [materialQuery, setMaterialQuery] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setPlantQuery(plant), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [plant])

  useEffect(() => {
    const id = setTimeout(() => setMaterialQuery(material), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [material])

  const reclassification = useI13Query(
    () => getI13Reclassification({ plant: plantQuery || undefined, material: materialQuery || undefined }),
    [plantQuery, materialQuery]
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Reclassification Candidates"
          description="OAR materials consumed frequently enough to warrant review as a stocked material — advisory evidence only, computed by the backend."
        />

        <FilterBar>
          <Input
            placeholder="Plant (1300 or 1500)"
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className="h-9 sm:w-40"
          />
          <Input
            placeholder="Material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="h-9 sm:w-40"
          />
        </FilterBar>

        {reclassification.loading && <LoadingState label="Loading reclassification candidates…" />}
        {reclassification.error && (
          <ErrorState
            message={reclassification.error}
            onRetry={reclassification.refetch}
            title="Unable to load reclassification candidates."
          />
        )}
        {reclassification.data && <ReclassificationTable candidates={reclassification.data} />}
      </div>
    </div>
  )
}
