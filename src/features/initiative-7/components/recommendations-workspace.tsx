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
  type DashboardFilterState,
} from "@/features/initiative-7/components/dashboard-filters"
import { useDebouncedValue } from "@/features/initiative-7/hooks/use-debounced-value"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import {
  listFilterKey,
  listParamsFromFilters,
  RECOMMENDATIONS_PAGE_SIZE,
} from "@/features/initiative-7/utils/recommendation-list-query"
import { hasRealCircuit } from "@/features/initiative-7/utils/circuit"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { formatCount } from "@/lib/utils"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

// Every filter below is sent to the backend (utils/recommendation-list-query.ts), which searches
// the whole catalogue and returns one page and the true total. Only Circuit still narrows the
// page in view, and the Circuit filter is offered only when the data carries real circuits.
const PAGE_SIZE = RECOMMENDATIONS_PAGE_SIZE

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

/** The one filter the backend does not take: the page's own circuit column. */
function applyCircuitFilter(recommendations: Recommendation[], circuit: string): Recommendation[] {
  return circuit === ALL_FILTER ? recommendations : recommendations.filter((r) => r.circuit === circuit)
}

function LiveRecommendationsWorkspace({
  filters,
  setFilters,
}: {
  filters: DashboardFilterState
  setFilters: (filters: DashboardFilterState) => void
}) {
  // The Material box asks the backend once typing pauses, not on every keystroke; every other
  // filter applies at once. The inputs themselves keep updating as the person types.
  const searchText = useDebouncedValue(filters.material)
  const queryFilters = { ...filters, material: searchText }

  // The one "Recommendation" dropdown: All, or one of OAR / Declining / Normal. A chosen
  // group lists only the recommendations that have been calculated (see listParamsFromFilters).
  const onlyCalculated = filters.type !== ALL_FILTER

  // Page number, back to 1 whenever any filter that decides the rows changes. Derived during
  // render -- not in an effect -- the way the live hooks do it.
  const filterKey = listFilterKey(queryFilters)
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  // Newest first (Part 27): the latest pipeline run is on page 1.
  const { data, total, loading, error, refetch } = useLiveRecommendations(listParamsFromFilters(queryFilters, page))
  const filtered = useMemo(
    () => (data ? applyCircuitFilter(dedupeByMaterialPlant(data), filters.circuit) : []),
    [data, filters.circuit],
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
        showTypeFilter
        typeFilterLabel="Recommendation"
        showCircuitFilter={hasRealCircuit(data ?? [])}
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
        <>
          <RecommendationReviewTable recommendations={filtered} />
          {total > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Showing {formatCount((page - 1) * PAGE_SIZE + 1)}–{formatCount(Math.min(total, page * PAGE_SIZE))} of{" "}
                {formatCount(total)}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page * PAGE_SIZE >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
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

  const banner = reviewMaterial && (
    <AlertBanner tone="info" title={`Reviewing material flagged by OAR Utilization for reclassification review — ${reviewMaterial}`}>
      A matching inventory planning recommendation may be in the table below.
    </AlertBanner>
  )

  return (
    <div className="flex flex-col gap-4">
      {banner}
      <LiveRecommendationsWorkspace filters={filters} setFilters={setFilters} />
    </div>
  )
}
