import type { Metadata } from "next"

import { RedeploymentPage } from "@/features/initiative-13/pages/redeployment-page"

export const metadata: Metadata = {
  title: "Redeployment — OAR Utilization — Spares AI",
}

export default function Page() {
  return <RedeploymentPage />
}
