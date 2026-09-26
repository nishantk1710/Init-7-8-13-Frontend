import type { Metadata } from "next"

import { WatchPage } from "@/features/initiative-13/pages/watch-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "WATCH — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <WatchPage searchParams={parseSearchParams(await searchParams)} />
}
