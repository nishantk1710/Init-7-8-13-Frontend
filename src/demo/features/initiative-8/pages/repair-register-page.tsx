"use client"

import { PageHeader } from "@demo/components/shared/page-header"
import { RepairRegisterTable } from "@demo/features/initiative-8/components/repair-register-table"
import { OVERDUE_GRACE_DAYS, REFERENCE_DATE } from "@demo/features/initiative-8/data/config"
import { isOpenLine } from "@demo/features/initiative-8/model/metrics"
import { useI08Snapshot } from "@demo/features/initiative-8/state/snapshot-store"
import { formatCount } from "@demo/lib/utils"
import { SessionChangesBanner } from "@demo/features/initiative-8/components/session-changes-banner"

/**
 * The Repair Register screen (FR-3, FR-9). A client component because the
 * lines include whatever the viewer has declared this session; the counts in
 * the header are worked out from the same lines as the table, so the two
 * cannot disagree.
 */
export function RepairRegisterPage() {
  const { lines } = useI08Snapshot()
  const open = lines.filter(isOpenLine)
  const overdue = open.filter((l) => l.overdueStatus === "OVERDUE").length
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <PageHeader
          title="Repair Register"
          description={`${formatCount(lines.length)} repair lines — ${formatCount(open.length)} still open, ${formatCount(overdue)} overdue after the ${OVERDUE_GRACE_DAYS}-day grace, as at ${REFERENCE_DATE}.`}
        />
        <SessionChangesBanner />
        <RepairRegisterTable />
      </div>
    </div>
  )
}
