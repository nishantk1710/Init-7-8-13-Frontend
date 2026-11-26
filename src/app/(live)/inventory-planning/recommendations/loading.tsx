import { RecommendationsSkeleton } from "@/features/initiative-7/components/skeletons"

/** Recommendations while it opens: the filter bar, the view toggle and the table, in bones. recommendations-page.tsx and its workspace show the same shape under the real header while they fetch. */
export default function Loading() {
  return <RecommendationsSkeleton />
}
