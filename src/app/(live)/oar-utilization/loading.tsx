import { OarDashboardSkeleton } from "@/features/initiative-13/components/skeletons"

/** The OAR Utilization dashboard while it is read: filters, the KPI cards, the follow-up pipeline and the Details card, in bones. Each other OAR screen has a loading.tsx of its own in its shape. */
export default function Loading() {
  return <OarDashboardSkeleton />
}
