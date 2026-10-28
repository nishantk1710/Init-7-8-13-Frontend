import type { Metadata } from "next"

import { InventoryReportsPage } from "@/features/initiative-7/pages/reports-page"

export const metadata: Metadata = {
  title: "Reports — Inventory Planning — Spares AI",
}

export default function Page() {
  return <InventoryReportsPage />
}
