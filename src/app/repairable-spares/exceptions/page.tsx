import type { Metadata } from "next"

import { ExceptionQueuePage } from "@/features/initiative-8/pages/exception-queue-page"

export const metadata: Metadata = {
  title: "Exception Queue — Repairable Spares — Spares AI",
}

export default function Page() {
  return <ExceptionQueuePage />
}
