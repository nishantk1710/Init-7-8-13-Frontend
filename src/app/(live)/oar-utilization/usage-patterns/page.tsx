import type { Metadata } from "next"

import { UsagePatternsPage } from "@/features/initiative-13/pages/usage-patterns-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Usage pattern — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <UsagePatternsPage searchParams={parseSearchParams(await searchParams)} />
}
