import type { Metadata } from "next"

import type { RawSearchParams } from "@/features/initiative-8/data/url-params"
import { RepairRegisterPage } from "@/features/initiative-8/pages/repair-register-page"

export const metadata: Metadata = {
  title: "Repair Register — Repairable Spares — Spares AI",
}

export default function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return <RepairRegisterPage searchParams={searchParams} />
}
