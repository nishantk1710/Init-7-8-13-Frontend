import type { Metadata } from "next"

import { ConsumptionPlansPage } from "@/features/initiative-13/pages/plans-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Consumption plans — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <ConsumptionPlansPage searchParams={parseSearchParams(await searchParams)} />
}
