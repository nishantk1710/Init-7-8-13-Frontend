"use client"

import { useEffect, useState } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { DataSourcePanel } from "@/features/initiative-13/components/data-source-panel"
import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { getI13Ledger } from "@/features/initiative-13/api/client"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"

const FILTER_DEBOUNCE_MS = 400

export function UtilizationLedgerPage() {
  const [plant, setPlant] = useState("")
  const [material, setMaterial] = useState("")
  // Debounced so typing a plant/material code doesn't fire a request per
  // keystroke — still a server-side filter (§21), just rate-limited.
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

  const ledger = useI13Query(
    () => getI13Ledger({ plant: plantQuery || undefined, material: materialQuery || undefined }),
    [plantQuery, materialQuery]
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Utilization Ledger"
          description="Every OAR purchase-requisition item, anchored end-to-end from reservation through goods issue. Click a row to see the full document chain."
        />

        {ledger.loading && <LoadingState label="Loading utilization ledger…" />}
        {ledger.error && (
          <ErrorState message={ledger.error} onRetry={ledger.refetch} title="Unable to load utilization data." />
        )}
        {ledger.data && (
          <UtilizationLedgerTable
            entries={ledger.data}
            plant={plant}
            material={material}
            onFilterPlant={setPlant}
            onFilterMaterial={setMaterial}
          />
        )}

        <DataSourcePanel />
      </div>
    </div>
  )
}
