import type { Metadata } from "next"

import { AgingExceptionsPage } from "@/features/initiative-13/pages/aging-exceptions-page"

export const metadata: Metadata = {
  title: "Aging Exceptions — OAR Utilization — Spares AI",
}

export default function Page() {
  return <AgingExceptionsPage />
}
