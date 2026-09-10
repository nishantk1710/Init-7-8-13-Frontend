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
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RecommendationDetailPage recommendationId={id} />
}
