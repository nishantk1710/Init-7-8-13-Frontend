import type { Metadata } from "next"

import { GlobalAuditLog } from "@/components/audit/global-audit-log"
import { getAllAuditEvents } from "@/lib/aggregation"

export const metadata: Metadata = {
  title: "Audit trail — Spares AI",
}

export default function AuditPage() {
  const events = getAllAuditEvents()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Audit trail
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full cross-initiative traceability log — every AI response, user
            selection, and workflow action.
          </p>
        </div>
        <GlobalAuditLog events={events} />
      </div>
    </div>
  )
}
