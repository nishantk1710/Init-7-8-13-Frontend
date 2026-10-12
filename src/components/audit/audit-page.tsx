import { connection } from "next/server"

import { auditBounds, AUDIT_PAGE_SIZE, type AuditFilters } from "@/components/audit/audit-params"
import { GlobalAuditLog } from "@/components/audit/global-audit-log"
import { FailureNotice } from "@/components/shared/load-status"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { getLiveAuditPage } from "@/lib/aggregation"

/**
 * The cross-initiative audit trail, read live from each module's own
 * append-only record and merged newest-first.
 *
 * What counts as an audit event is "something a person or a run did in this
 * platform": approval-ledger actions (Inventory Planning), recorded
 * condition-to-repair declarations (Repairable Spares) and ACT exception events
 * (OAR Utilization). SAP document dates are not events here, because nothing in
 * this platform observed them happen.
 */
export async function AuditTrailPage({ filters }: { filters: AuditFilters }) {
  // Without this `next build` would fetch once and serve that snapshot forever.
  await connection()

  const result = await getLiveAuditPage({
    page: filters.page,
    pageSize: AUDIT_PAGE_SIZE,
    initiative: filters.initiative,
    ...auditBounds(filters),
  })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Audit trail"
          description="Every decision and workflow action recorded across all three initiatives, newest first."
          actions={<ProfileMenu />}
        />
        <FailureNotice failures={result.failures} />
        <GlobalAuditLog
          events={result.events}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          lastPage={result.lastPage}
          truncated={result.truncated}
          filters={{ ...filters, page: result.page }}
          incomplete={result.failures.length > 0}
        />
      </div>
    </div>
  )
}
