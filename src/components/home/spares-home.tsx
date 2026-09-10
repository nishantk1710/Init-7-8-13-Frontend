"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ClipboardCheck } from "lucide-react"

import { AttentionRequiredPanel } from "@/components/home/attention-required-panel"
import { InitiativeSummaryCard } from "@/components/home/initiative-summary-card"
import { MaterialRiskLandscape } from "@/components/home/material-risk-landscape"
import { RecentEventsFeed } from "@/components/home/recent-events-feed"
import { RoleSwitcher } from "@/components/home/role-switcher"
import { PageHeader } from "@/components/shared/page-header"
import {
  getAllAuditEvents,
  getAllGlobalActions,
  getAllInitiativeSummaries,
} from "@/lib/aggregation"
import { getPendingApprovals } from "@/lib/approvals"
import { sortActionsForRole } from "@/lib/home-priority"
import { MATERIALS } from "@/lib/shared-data/material-catalog"
import type { SharedRole } from "@/lib/shared-data/users"

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * Home — the landing page (§5). Its one job is answering "what needs my
 * attention today", not showing every metric — the per-module Overview
 * pages (reachable from the sidebar) are where the detailed charts live.
 */
export function SparesHome() {
  const [role, setRole] = useState<SharedRole>("End User")

  const summaries = getAllInitiativeSummaries()
  const events = getAllAuditEvents()
  const pendingApprovals = getPendingApprovals()
  const actions = useMemo(
    () => sortActionsForRole(getAllGlobalActions(), role),
    [role]
  )

  const [, initiative8, initiative13] = summaries
  const lowStockMaterials = [...MATERIALS]
    .sort((a, b) => a.stockLevel - b.stockLevel)
    .slice(0, 5)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          title={`${greeting()}. Here's what needs your attention today.`}
          actions={<RoleSwitcher value={role} onChange={setRole} />}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaries.map((summary) => (
            <InitiativeSummaryCard key={summary.id} summary={summary} />
          ))}
          <Link
            href="/approvals"
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Pending Approvals</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ClipboardCheck className="size-3" />
              {pendingApprovals.length === 0 ? "Nothing waiting" : "Needs your decision"}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Waiting for a decision</div>
              <div className="text-sm font-medium text-foreground">{pendingApprovals.length}</div>
            </div>
          </Link>
        </div>

        <AttentionRequiredPanel actions={actions} />

        <MaterialRiskLandscape
          lowStockMaterials={lowStockMaterials}
          initiative8Summary={initiative8}
          initiative13Summary={initiative13}
        />

        <RecentEventsFeed events={events} />
      </div>
    </div>
  )
}
