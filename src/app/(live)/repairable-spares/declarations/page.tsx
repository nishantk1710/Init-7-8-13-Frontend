import type { Metadata } from "next"

import { DeclarationsPage } from "@/features/initiative-8/pages/declarations-page"

export const metadata: Metadata = {
  title: "Declarations — Repairable Spares — Spares AI",
}

export default function Page() {
  return <DeclarationsPage />
}
