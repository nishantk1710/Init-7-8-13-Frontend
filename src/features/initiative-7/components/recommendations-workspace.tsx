"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RecommendationReviewTable } from "@/features/initiative-7/components/recommendation-review-table"
import {
  ALL_FILTER,
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  RECOMMENDATION_FILTER_CALCULATED,
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { RECOMMENDATIONS, getRecommendationsForMaterial } from "@/features/initiative-7/data/recommendations"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { sapPlantLabel } from "@/features/initiative-7/utils/sap-plants"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"
import { formatCount } from "@/lib/utils"

// The backend's own page-size ceiling (see app/api/i7/recommendations.py's
// MAX_PAGE_SIZE) -- fetched once and filtered client-side below, exactly
// like the existing scenario/generated modes, so every existing filter stays
// untouched rather than being re-implemented as backend query params.
const LIVE_PAGE_SIZE = 200

/** Repeated pipeline runs during testing can leave more than one
 * recommendation row per material-plant (see recommendation_id not being a
 * database-unique key). Keeps only the first occurrence of each
 * material+plant pair -- with the live workspace's newest-first sort, that is
 * the newest row -- so the same material never appears twice in the table. */
function dedupeByMaterialPlant(recommendations: Recommendation[]): Recommendation[] {
  const seen = new Set<string>()
  const result: Recommendation[] = []
  for (const rec of recommendations) {
    const key = `${rec.material.materialId}|${rec.plantId}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(rec)
  }
  return result
}

function applyFilters(recommendations: Recommendation[], filters: DashboardFilterState): Recommendation[] {
  const query = filters.material.trim().toLowerCase()
  return recommendations.filter((r) => {
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
}

function LiveRecommendationsWorkspace({
  filters,
  setFilters,
}: {
  filters: DashboardFilterState
  setFilters: (filters: DashboardFilterState) => void
}) {
  // Both the plant and the calculated-only filters are pushed to the backend
  // rather than applied client-side: at ~113k rows, only a handful of which
  // ever reach READY_FOR_REVIEW, filtering one fetched page would show zero
  // matches even though qualifying rows exist elsewhere in the full set. The
  // existing "Recommendation Status" filter can't express calculated-vs-
  // blocked either -- READY_FOR_REVIEW and NOT_EVALUABLE both map to the same
  // "Pending Review" display label (see i7-api.ts's STATUS_MAP).
  const onlyCalculated = filters.recommendation === RECOMMENDATION_FILTER_CALCULATED

  // Part 27: newest-first, not the backend's default oldest-first ordering
  // -- at this row count an unsorted first page is effectively a random slice
  // of the oldest rows and will almost never include a material generated in
  // the most recent pipeline run. sort_desc is the existing Part 22
  // capability; no new backend behaviour is introduced.
  const { data, loading, error, refetch } = useLiveRecommendations({
    pageSize: LIVE_PAGE_SIZE,
    sort: "generated_at",
    sortDesc: true,
    status: onlyCalculated ? "READY_FOR_REVIEW" : undefined,
    plant: filters.plant !== ALL_FILTER ? filters.plant : undefined,
  })
  // Plant is filtered in SQL above, so it is excluded from the client-side
  // pass -- leaving it in would re-test the same predicate against a page
  // that is already scoped to that plant.
  const filtered = useMemo(
    () =>
      data
        ? applyFilters(dedupeByMaterialPlant(data), { ...filters, plant: ALL_FILTER })
        : [],
    [data, filters],
  )

  // The real SAP plant codes present in the data. The app-side PLANTS list
  // (PLANT-GBG etc.) can never match a live row's WERKS code, so a filter
  // built from it silently matched nothing -- see utils/sap-plants.ts.
  //
  // Scoped to the same status the table is showing, so counts reflect what
  // the dropdown selection would actually show. Both VZI plants (Black
  // Mountain/1300, Gamsberg/1500) are always offered even with a 0 count --
  // Gamsberg has no MARC coverage today (see CLAUDE.md's plant-coverage-gap
  // note) so it would otherwise silently disappear from the dropdown
  // whenever the calculated-only filter is active, which reads as "Gamsberg
  // doesn't exist" rather than "Gamsberg has no calculated recommendations
  // yet". Any other plant code the data does carry rows for (3000, 2000,
  // etc.) is still appended so a real row is never hidden.
  const { summary } = useLiveRecommendationSummary(
    onlyCalculated ? { status: "READY_FOR_REVIEW" } : {},
  )
  const ALWAYS_OFFERED_PLANTS = ["1300", "1500"]
  const plantOptions = useMemo(() => {
    const counts = new Map((summary?.byPlant ?? []).map((p) => [p.plant, p.count]))
    const codes = [
      ...ALWAYS_OFFERED_PLANTS,
      ...[...counts.keys()].filter((code) => !ALWAYS_OFFERED_PLANTS.includes(code)),
    ]
    return codes.map((code) => ({
      value: code,
      label: sapPlantLabel(code),
    }))
  }, [summary])

  // Switching to calculated-only narrows the plant list, which can strip out
  // the plant already selected -- leaving a filter active that the dropdown
  // no longer shows and the table cannot satisfy. Reset it to All rather than
  // leaving that invisible state. Done during render (not in an effect) per
  // the same react-hooks/set-state-in-effect rule the live hooks follow.
  const selectedPlantMissing =
    filters.plant !== ALL_FILTER &&
    summary != null &&
    !plantOptions.some((p) => p.value === filters.plant)
  if (selectedPlantMissing) {
    setFilters({ ...filters, plant: ALL_FILTER })
  }

  return (
    <div className="flex flex-col gap-4">
      <DashboardFilters
        value={filters}
        onChange={setFilters}
        layout="bar"
        plantOptions={plantOptions}
        showRecommendationFilter
      />
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="size-4" />}
          title="Could not load recommendations from the backend"
          description={error.message}
          actions={
            <Button size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          }
        />
      ) : (
        <RecommendationReviewTable recommendations={filtered} />
      )}
    </div>
  )
}

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

  const filtered = useMemo(() => applyFilters(RECOMMENDATIONS, filters), [filters])

  const banner = reviewMaterial && (
    <AlertBanner tone="info" title={`Reviewing material flagged by OAR Utilization for reclassification review — ${reviewMaterial}`}>
      {matches.length > 0
        ? "A matching inventory planning recommendation is in the table below."
        : "No open inventory planning recommendation exists yet for this material."}
    </AlertBanner>
  )

  if (USING_LIVE_DATA) {
    return (
      <div className="flex flex-col gap-4">
        {banner}
        <LiveRecommendationsWorkspace filters={filters} setFilters={setFilters} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {banner}
      <DashboardFilters value={filters} onChange={setFilters} layout="bar" />
      <RecommendationReviewTable recommendations={filtered} />
    </div>
  )
}
