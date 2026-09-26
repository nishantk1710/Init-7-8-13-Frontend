import type { Metadata } from "next"

import { UtilizationLedgerPage } from "@/features/initiative-13/pages/ledger-page"
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/features/initiative-13/utils/search-params"

export const metadata: Metadata = {
  title: "Utilization Ledger — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <UtilizationLedgerPage searchParams={parseSearchParams(await searchParams)} />
}
