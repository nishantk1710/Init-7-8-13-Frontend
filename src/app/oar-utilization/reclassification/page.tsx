import type { Metadata } from "next"

import { ReclassificationPage } from "@/features/initiative-13/pages/reclassification-page"

export const metadata: Metadata = {
  title: "Reclassification Candidates — OAR Utilization — Spares AI",
}

export default function Page() {
  return <ReclassificationPage />
}
