import type { Metadata } from "next"

import { RefurbishableSparesOverviewPage } from "@/features/initiative-8/pages/overview-page"

export const metadata: Metadata = {
  title: "Repairable Spares — Spares AI",
}

export default function Page() {
  return <RefurbishableSparesOverviewPage />
}
