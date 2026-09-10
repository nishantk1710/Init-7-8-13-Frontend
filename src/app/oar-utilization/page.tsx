import type { Metadata } from "next"

import { OARUtilizationOverviewPage } from "@/features/initiative-13/pages/overview-page"

export const metadata: Metadata = {
  title: "OAR Utilization — Spares AI",
}

export default function Page() {
  return <OARUtilizationOverviewPage />
}
