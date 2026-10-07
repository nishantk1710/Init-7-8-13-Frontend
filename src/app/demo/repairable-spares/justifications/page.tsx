import type { Metadata } from "next"

import { JustificationsPage } from "@demo/features/initiative-8/pages/justifications-page"

export const metadata: Metadata = {
  title: "New-acquisition justifications — Repairable Spares — Spares AI",
}

export default function Page() {
  return <JustificationsPage />
}
