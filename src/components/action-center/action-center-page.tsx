import { connection } from "next/server"

import { ActionCenterTabs } from "@/components/action-center/action-center-tabs"
import { CappedNotice, FailureNotice } from "@/components/shared/load-status"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { combineActions, getLiveActions, INITIATIVE_IDS } from "@/lib/aggregation"
import type { InitiativeId } from "@/lib/domain/contracts"

export async function ActionCenterPage() {
  // Without this `next build` would fetch once and serve that snapshot forever.
  await connection()

  const per = await getLiveActions()
  const combined = combineActions(per)

  // The true population per module, not the length of the capped list — and
  // null for a module that did not answer, so its tab does not read as "0".
  const counts = Object.fromEntries(
    INITIATIVE_IDS.map((id) => {
      const section = per[id]
      return [id, section.status === "ready" ? section.data.total : null]
    })
  ) as Record<InitiativeId, number | null>

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Action Center"
          description="Every open item across inventory planning, repairable spares and OAR utilization."
          actions={<ProfileMenu />}
        />
        <FailureNotice failures={combined.failures} />
        {combined.capped && (
          <CappedNotice shown={combined.actions.length} total={combined.total} noun="open items" />
        )}
        <ActionCenterTabs actions={combined.actions} counts={counts} />
      </div>
    </div>
  )
}
