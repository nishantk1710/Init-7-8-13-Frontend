import { RecommendationDetailSkeleton } from "@/features/initiative-7/components/skeletons"

/** One recommendation while it opens: the back link, the header, the chips and the two cards, in bones. recommendation-detail-page.tsx shows the same while it fetches. */
export default function Loading() {
  return <RecommendationDetailSkeleton />
}
