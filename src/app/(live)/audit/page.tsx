import type { Metadata } from "next"

import { AuditTrailPage } from "@/components/audit/audit-page"
import { parseAuditFilters, type RawParams } from "@/components/audit/audit-params"

export const metadata: Metadata = {
  title: "Audit trail — Spares AI",
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  return <AuditTrailPage filters={parseAuditFilters(await searchParams)} />
}
