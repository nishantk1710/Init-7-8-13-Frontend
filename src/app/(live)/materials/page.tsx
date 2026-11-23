import type { Metadata } from "next"

import { MaterialsPage } from "@/components/materials/materials-page"
import { parseMaterialsFilters, type RawParams } from "@/components/materials/materials-params"

export const metadata: Metadata = {
  title: "Materials — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  return <MaterialsPage filters={parseMaterialsFilters(await searchParams)} />
}
