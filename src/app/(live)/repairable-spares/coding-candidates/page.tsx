import type { Metadata } from "next"

import { CodingCandidatesPage } from "@/features/initiative-8/pages/coding-candidates-page"

export const metadata: Metadata = {
  title: "Coding Candidates — Repairable Spares — Spares AI",
}

export default function Page() {
  return <CodingCandidatesPage />
}
