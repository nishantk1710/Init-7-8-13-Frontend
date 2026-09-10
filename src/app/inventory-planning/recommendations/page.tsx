import type { Metadata } from "next"

import { RecommendationsPage } from "@/features/initiative-7/pages/recommendations-page"

export const metadata: Metadata = {
  title: "Recommendations — Inventory Planning — Spares AI",
}

export default function Page() {
  return <RecommendationsPage />
}
