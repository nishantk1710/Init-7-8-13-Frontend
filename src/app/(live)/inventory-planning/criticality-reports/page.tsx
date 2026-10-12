import type { Metadata } from "next"

import { CriticalityReportsPage } from "@/features/initiative-7/pages/criticality-reports-page"

export const metadata: Metadata = {
  title: "Criticality Reports — Inventory Planning — Spares AI",
}

export default function Page() {
  return <CriticalityReportsPage />
}
