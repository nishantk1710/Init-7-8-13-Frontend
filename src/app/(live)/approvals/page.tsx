import type { Metadata } from "next"

import { ApprovalsPage } from "@/components/approvals/approvals-page"

export const metadata: Metadata = {
  title: "Approvals — Spares AI",
}

export default function Page() {
  return <ApprovalsPage />
}
