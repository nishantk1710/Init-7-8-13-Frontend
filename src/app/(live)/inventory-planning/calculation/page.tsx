import type { Metadata } from "next"

import { KpiFormulasPage } from "@/features/initiative-7/pages/kpi-formulas-page"

export const metadata: Metadata = {
  title: "Calculation — Inventory Planning — Spares AI",
}

export default function Page() {
  return <KpiFormulasPage />
}
