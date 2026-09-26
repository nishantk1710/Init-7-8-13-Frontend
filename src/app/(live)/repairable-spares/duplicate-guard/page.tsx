import type { Metadata } from "next"

import { DuplicateGuardPage } from "@/features/initiative-8/pages/duplicate-guard-page"

export const metadata: Metadata = {
  title: "Duplicate Guard — Repairable Spares — Spares AI",
}

export default function Page() {
  return <DuplicateGuardPage />
}
