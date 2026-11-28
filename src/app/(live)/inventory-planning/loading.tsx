import { OverviewSkeleton } from "@/features/initiative-7/components/skeletons"

/** The Inventory Planning overview while it opens: the header, the filter bar, the KPI cards and the charts, in bones. Each other Inventory Planning screen has a loading.tsx of its own in its shape; live-overview-workspace.tsx shows this one's body under the real header while it fetches. */
export default function Loading() {
  return <OverviewSkeleton />
}
