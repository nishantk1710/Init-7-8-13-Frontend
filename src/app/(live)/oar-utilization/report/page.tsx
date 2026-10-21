import type { Metadata } from "next"

import { SummaryReportPage } from "@/features/initiative-13/pages/summary-report-page"

export const metadata: Metadata = {
  title: "Summary report — OAR Utilization — Spares AI",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>
}) {
  const { id } = await searchParams
  return <SummaryReportPage reportId={Array.isArray(id) ? id[0] : id} />
}
