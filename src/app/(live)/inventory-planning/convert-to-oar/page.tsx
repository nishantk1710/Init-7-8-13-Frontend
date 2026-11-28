import type { Metadata } from "next"

import { ConvertToOarDecisionPage } from "@/features/initiative-7/pages/convert-to-oar-decision-page"

export const metadata: Metadata = {
  title: "Convert to OAR — Inventory Planning — Spares AI",
}

export default function Page() {
  return <ConvertToOarDecisionPage />
}
