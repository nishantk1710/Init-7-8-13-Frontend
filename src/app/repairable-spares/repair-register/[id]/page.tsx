import type { Metadata } from "next"

import { RepairDetailPage } from "@/features/initiative-8/pages/repair-detail-page"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `${id} — Repairable Spares — Spares AI` }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RepairDetailPage repairId={id} />
}
