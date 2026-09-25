"use client"

import Link from "next/link"

import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getPlantById } from "@/lib/shared-data/plants"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

const STATUS_TONE: Record<Recommendation["status"], "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

/** Most recently generated recommendations, linking straight into the detail
 * explainability workspace. In live mode, ignores the `recommendations` prop
 * default and fetches the most recent page from the backend directly (sorted
 * by generated_at desc, page_size = limit) rather than requiring every
 * caller to pass live data in themselves. */
export function RecentRecommendationsList({
  recommendations = RECOMMENDATIONS,
  limit = 5,
}: {
  recommendations?: Recommendation[]
  limit?: number
}) {
  if (USING_LIVE_DATA) {
    return <LiveRecentRecommendationsList limit={limit} />
  }
  return <RecentRecommendationsListView recommendations={recommendations} limit={limit} />
}

function LiveRecentRecommendationsList({ limit }: { limit: number }) {
  const { data, loading, error } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    pageSize: limit,
  })

  if (loading) return <Skeleton className="h-32 w-full" />
  if (error) {
    return <p className="text-sm text-destructive">Could not load recent recommendations: {error.message}</p>
  }
  return <RecentRecommendationsListView recommendations={data ?? []} limit={limit} />
}

function RecentRecommendationsListView({
  recommendations,
  limit,
}: {
  recommendations: Recommendation[]
  limit: number
}) {
  const items = [...recommendations]
    .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))
    .slice(0, limit)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No recommendations match the current filters.
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/inventory-planning/recommendations/${r.id}`}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{r.material.description}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {r.material.materialId} · {getPlantById(r.plantId)?.name ?? r.plantId} · {r.circuit}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RiskBadge level={r.risk} />
              <StatusBadge tone={STATUS_TONE[r.status]}>{r.status}</StatusBadge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
