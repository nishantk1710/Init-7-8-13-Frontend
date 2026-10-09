import type { Metadata } from "next"

import { ReclassificationPage } from "@/features/initiative-13/pages/reclassification-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Reclassification Candidates — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <ReclassificationPage searchParams={parseSearchParams(await searchParams)} />
}
