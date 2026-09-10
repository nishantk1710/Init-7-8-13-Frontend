"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { AlertBanner } from "@/components/shared/alert-banner"
import { RecommendationReviewTable } from "@/features/initiative-7/components/recommendation-review-table"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { RECOMMENDATIONS, getRecommendationsForMaterial } from "@/features/initiative-7/data/recommendations"

/**
 * Reads the optional `?reviewMaterial=<materialId>` query param — the exact
 * landing point Initiative 13 links to from its reclassification workflow
 * ("Review in Initiative 7"). Shows an advisory banner regardless of whether
 * a matching recommendation exists.
 */
export function RecommendationsWorkspace() {
  const searchParams = useSearchParams()
  const reviewMaterial = searchParams.get("reviewMaterial")
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_DASHBOARD_FILTERS)

  const matches = reviewMaterial ? getRecommendationsForMaterial(reviewMaterial) : []

  const filtered = useMemo(() => {
    const query = filters.material.trim().toLowerCase()
    return RECOMMENDATIONS.filter((r) => {
      if (filters.plant !== ALL_FILTER && r.plantId !== filters.plant) return false
      if (filters.circuit !== ALL_FILTER && r.circuit !== filters.circuit) return false
      if (filters.criticality !== ALL_FILTER && r.criticality !== filters.criticality) return false
      if (filters.demandPattern !== ALL_FILTER && r.demandPattern !== filters.demandPattern) return false
      if (filters.status !== ALL_FILTER && r.status !== filters.status) return false
      if (filters.risk !== ALL_FILTER && r.risk !== filters.risk) return false
      if (query) {
        const haystack = `${r.material.materialId} ${r.material.description}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [filters])

  return (
    <div className="flex flex-col gap-4">
      {reviewMaterial && (
        <AlertBanner tone="info" title={`Reviewing material flagged by OAR Utilization for reclassification review — ${reviewMaterial}`}>
          {matches.length > 0
            ? "A matching inventory planning recommendation is in the table below."
            : "No open inventory planning recommendation exists yet for this material."}
        </AlertBanner>
      )}

      <DashboardFilters value={filters} onChange={setFilters} layout="bar" />
      <RecommendationReviewTable recommendations={filtered} />
    </div>
  )
}
