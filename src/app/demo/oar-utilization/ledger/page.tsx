import type { Metadata } from "next"

import { UtilizationLedgerPage } from "@demo/features/initiative-13/pages/ledger-page"

export const metadata: Metadata = {
  title: "Utilization Ledger — OAR Utilization — Spares AI",
}

export default function Page() {
  return <UtilizationLedgerPage />
}
