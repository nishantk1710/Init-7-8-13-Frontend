import type { Metadata } from "next"

import { ValidationPage } from "@/features/initiative-13/pages/validation-page"

export const metadata: Metadata = {
  title: "Validation — OAR Utilization — Spares AI",
}

export default function Page() {
  return <ValidationPage />
}
