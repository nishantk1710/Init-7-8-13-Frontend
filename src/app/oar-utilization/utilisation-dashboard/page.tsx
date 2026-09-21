import type { Metadata } from "next"

import { UtilisationDashboardPage } from "@/features/initiative-13/pages/utilisation-dashboard-page"

export const metadata: Metadata = {
  title: "Utilisation Dashboard — OAR Utilization — Spares AI",
}

export default function Page() {
  return <UtilisationDashboardPage />
}
