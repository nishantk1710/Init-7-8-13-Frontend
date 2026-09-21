import type { Metadata } from "next"

import { ExceptionsPage } from "@/features/initiative-13/pages/aging-exceptions-page"

export const metadata: Metadata = {
  title: "Exceptions — OAR Utilization — Spares AI",
}

export default function Page() {
  return <ExceptionsPage />
}
