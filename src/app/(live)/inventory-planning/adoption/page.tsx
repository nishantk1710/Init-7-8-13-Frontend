import type { Metadata } from "next"

import { InventoryAdoptionPage } from "@/features/initiative-7/pages/adoption-page"

export const metadata: Metadata = {
  title: "Adoption Tracking — Inventory Planning — Spares AI",
}

export default function Page() {
  return <InventoryAdoptionPage />
}
