"use client"

import { useState } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getI13Validation } from "@/features/initiative-13/api/client"
import { ErrorState, LoadingState } from "@/features/initiative-13/components/query-states"
import { ValidationPanel } from "@/features/initiative-13/components/validation-panel"
import { useI13Query } from "@/features/initiative-13/hooks/use-i13-query"

export function ValidationPage() {
  const [zmm065Input, setZmm065Input] = useState("")
  const [gr30DayInput, setGr30DayInput] = useState("")
  const [zmm065ReferenceCount, setZmm065ReferenceCount] = useState<number | undefined>(undefined)
  const [gr30DayReferenceCount, setGr30DayReferenceCount] = useState<number | undefined>(undefined)

  const validation = useI13Query(
    () => getI13Validation({ zmm065ReferenceCount, gr30DayReferenceCount }),
    [zmm065ReferenceCount, gr30DayReferenceCount]
  )

  function applyReferenceCounts(e: React.FormEvent) {
    e.preventDefault()
    setZmm065ReferenceCount(zmm065Input.trim() === "" ? undefined : Number(zmm065Input))
    setGr30DayReferenceCount(gr30DayInput.trim() === "" ? undefined : Number(gr30DayInput))
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Validation"
          description="Reconciliation of backend-computed counts against ZMM065 and the 30-Day GR Report. All reconciliation math runs in the backend — reference counts entered here are passed straight through as query parameters."
        />

        <form onSubmit={applyReferenceCounts}>
          <FilterBar>
            <Input
              type="number"
              placeholder="ZMM065 reference count"
              value={zmm065Input}
              onChange={(e) => setZmm065Input(e.target.value)}
              className="h-9 sm:w-56"
            />
            <Input
              type="number"
              placeholder="30-Day GR reference count"
              value={gr30DayInput}
              onChange={(e) => setGr30DayInput(e.target.value)}
              className="h-9 sm:w-56"
            />
            <Button type="submit" size="sm">
              Apply reference counts
            </Button>
          </FilterBar>
        </form>

        {validation.loading && <LoadingState label="Loading validation results…" />}
        {validation.error && (
          <ErrorState message={validation.error} onRetry={validation.refetch} title="Unable to load validation data." />
        )}
        {validation.data && <ValidationPanel result={validation.data} />}
      </div>
    </div>
  )
}
