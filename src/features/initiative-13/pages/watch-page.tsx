"use client"

import { useEffect, useState } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { WatchTable } from "@/features/initiative-13/components/watch-table"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { getI13Watch } from "@/features/initiative-13/api/client"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"

const FILTER_DEBOUNCE_MS = 400

export function WatchPage() {
  const [plant, setPlant] = useState("")
  const [material, setMaterial] = useState("")
  const [agingBand, setAgingBand] = useState("")
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

  const watch = useI13Query(
    () =>
      getI13Watch({
        plant: plantQuery || undefined,
        material: materialQuery || undefined,
        agingBand: agingBand || undefined,
      }),
    [plantQuery, materialQuery, agingBand]
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="WATCH"
          description="Backend-computed utilisation health per material and plant — months of cover, aging band, GR-not-issued, and acquired-vs-plan status."
        />

        {watch.loading && <LoadingState label="Loading WATCH metrics…" />}
        {watch.error && (
          <ErrorState message={watch.error} onRetry={watch.refetch} title="Unable to load WATCH data." />
        )}
        {watch.data && (
          <WatchTable
            metrics={watch.data}
            plant={plant}
            material={material}
            agingBand={agingBand}
            onFilterPlant={setPlant}
            onFilterMaterial={setMaterial}
            onFilterAgingBand={setAgingBand}
          />
        )}
      </div>
    </div>
  )
}
