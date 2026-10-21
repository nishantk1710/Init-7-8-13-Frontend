// Stockout and excess counts for All plants, 1300 and 1500: three calls to the existing summary
// endpoint, which already takes a plant filter. All three or none -- a chart that shows two plants
// and silently lacks the third would mislead, so one failure is one error.
//
// With a plant chosen on the Overview's filter rail only that plant is asked for, and the rest of
// the rail (OAR or stock item, criticality, demand pattern) narrows every call, so the two cards
// follow the page's filters the way the KPI row does.

"use client"

import { useEffect, useState } from "react"

import { fetchRecommendationSummary } from "@/features/initiative-7/services/i7-api"
import { POSITION_SCOPES, toPlantPosition, type PlantPosition, type PositionScope } from "@/features/initiative-7/utils/plant-position"

export interface PlantPositionsState {
  positions: PlantPosition[]
  loading: boolean
  error: Error | null
}

export interface PlantPositionFilters {
  /** One SAP plant code: only that plant's bar. Omitted: All plants and each plant. */
  plant?: string
  /** true: OAR recommendations only; false: stock items only; omitted: both. */
  isOar?: boolean
  demandClass?: string
  /** The raw ZMM065 tier (CRITICAL, IMPACT, INSURANCE). */
  criticality?: string
  /** False: ask for nothing (the caller already knows the filters cannot be applied). */
  enabled?: boolean
}

export function usePlantPositions(filters: PlantPositionFilters = {}): PlantPositionsState {
  const [state, setState] = useState<PlantPositionsState>({ positions: [], loading: true, error: null })

  // Back to "loading" the moment a filter changes, during render rather than in the effect.
  const filtersKey = JSON.stringify(filters)
  const [requestKey, setRequestKey] = useState(filtersKey)
  if (requestKey !== filtersKey) {
    setRequestKey(filtersKey)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    const { plant, isOar, demandClass, criticality, enabled = true } = JSON.parse(filtersKey) as PlantPositionFilters
    if (!enabled) return
    const scopes: PositionScope[] = plant ? [plant as PositionScope] : POSITION_SCOPES
    let cancelled = false
    Promise.all(
      scopes.map(async (scope) =>
        toPlantPosition(
          scope,
          await fetchRecommendationSummary({
            plant: scope === "ALL" ? undefined : scope,
            isOar,
            demandClass,
            criticality,
          }),
        ),
      ),
    )
      .then((positions) => {
        if (!cancelled) setState({ positions, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            positions: [],
            loading: false,
            error: err instanceof Error ? err : new Error("Failed to load the plant position."),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [filtersKey])

  return state
}
