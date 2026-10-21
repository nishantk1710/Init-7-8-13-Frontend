import type { Metadata } from "next"

import { AdoptionTrackingPage } from "@demo/features/initiative-7/pages/adoption-tracking-page"

export const metadata: Metadata = {
  title: "Adoption Tracking — Inventory Planning — Spares AI",
}

export default function Page() {
  return <AdoptionTrackingPage />
}
