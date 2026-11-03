"use client"

import { useState } from "react"

import { CappedNotice } from "@/components/shared/load-status"
import { LiveApprovalsWorkspace, type ApprovalsSummary } from "@/features/initiative-7/components/live-approvals-workspace"
import { initiative7Manifest } from "@/features/initiative-7/manifest"

/**
 * The Action Center lists Inventory Planning only: its own approvals workspace (queues, filters, sort, the change table
 * and the per-recommendation approval-chain panel). Repairable Spares has no approval flow, and OAR Utilization is
 * answered from its own Procurement Exceptions page and listed on Approvals, so neither is here.
 *
 * With one module there is nothing to switch between, so the module is only named, as a heading.
 *
 * A client component for one reason: the "Showing X of Y" card has to say what the workspace is showing, and only the
 * workspace knows that.
 */
export function ActionCenterView() {
  const [summary, setSummary] = useState<ApprovalsSummary | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <CappedNotice shown={summary.shown} total={summary.total} noun="recommendations" description={null} />
      )}
      <h2 className="text-base font-semibold text-foreground">{initiative7Manifest.name}</h2>
      <LiveApprovalsWorkspace onSummaryChange={setSummary} />
    </div>
  )
}
