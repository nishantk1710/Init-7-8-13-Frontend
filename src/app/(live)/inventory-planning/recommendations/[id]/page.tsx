import type { Metadata } from "next"

import { RecommendationDetailPage } from "@/features/initiative-7/pages/recommendation-detail-page"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `${id} — Inventory Planning — Spares AI` }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ review?: string }>
}) {
  const { id } = await params
  const { review } = await searchParams
  // Opened from the Action Center's Review button (?review=1): this is where it is decided. Opened from the
  // Recommendations pages it only sends for approval.
  return <RecommendationDetailPage recommendationId={id} decide={review === "1"} />
}
