import type { Metadata } from "next"

import { RepairRegisterPage } from "@/features/initiative-8/pages/repair-register-page"

export const metadata: Metadata = {
  title: "Repair Register — Repairable Spares — Spares AI",
}

export default function Page() {
  return <RepairRegisterPage />
}
