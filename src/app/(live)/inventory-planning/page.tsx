import type { Metadata } from "next"

import { InventoryOptimizationOverviewPage } from "@/features/initiative-7/pages/overview-page"

export const metadata: Metadata = {
  title: "Inventory Planning — Spares AI",
}

export default function Page() {
  return <InventoryOptimizationOverviewPage />
}
