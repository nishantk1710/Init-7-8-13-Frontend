import type { Metadata } from "next"

import { DeclarationQueuePage } from "@/features/initiative-8/pages/declarations-page"

export const metadata: Metadata = {
  title: "Declaration Queue — Repairable Spares — Spares AI",
}

export default function Page() {
  return <DeclarationQueuePage />
}
