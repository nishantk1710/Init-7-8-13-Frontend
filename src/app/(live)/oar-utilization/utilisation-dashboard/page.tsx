import type { Metadata } from "next"

import { UtilisationDashboardPage } from "@/features/initiative-13/pages/utilisation-dashboard-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Utilisation Dashboard — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <UtilisationDashboardPage searchParams={parseSearchParams(await searchParams)} />
}
