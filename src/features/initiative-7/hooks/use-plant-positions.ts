// Stockout and excess counts for All plants, 1300 and 1500: three calls to the existing summary
// endpoint, which already takes a plant filter. All three or none -- a chart that shows two plants
// and silently lacks the third would mislead, so one failure is one error.

"use client"

import { useEffect, useState } from "react"

import { fetchRecommendationSummary } from "@/features/initiative-7/services/i7-api"
import { POSITION_SCOPES, toPlantPosition, type PlantPosition } from "@/features/initiative-7/utils/plant-position"

export interface PlantPositionsState {
  positions: PlantPosition[]
  loading: boolean
  error: Error | null
}

export function usePlantPositions(): PlantPositionsState {
  const [state, setState] = useState<PlantPositionsState>({ positions: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    Promise.all(
      POSITION_SCOPES.map(async (scope) =>
        toPlantPosition(scope, await fetchRecommendationSummary(scope === "ALL" ? {} : { plant: scope })),
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
  }, [])

  return state
}
