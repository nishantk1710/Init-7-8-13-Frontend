import type { Metadata } from "next"

import { MaterialDetailPage } from "@/components/materials/material-detail-page"
import { getMaterialById } from "@/lib/shared-data/material-catalog"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ materialId: string }>
}): Promise<Metadata> {
  const { materialId } = await params
  const material = getMaterialById(materialId)
  return { title: `${material?.description ?? materialId} — Spares AI` }
}

export default async function Page({
  params,
}: {
  params: Promise<{ materialId: string }>
}) {
  const { materialId } = await params
  return <MaterialDetailPage materialId={materialId} />
}
