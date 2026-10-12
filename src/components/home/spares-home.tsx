import Link from "next/link"
import { connection } from "next/server"
import { ArrowRight, ClipboardCheck } from "lucide-react"

import { HomeGreeting } from "@/components/home/home-greeting"
import { InitiativeSummaryCard, SummaryCardFailure } from "@/components/home/initiative-summary-card"
import { MaterialRiskLandscape } from "@/components/home/material-risk-landscape"
import { PriorityActions } from "@/components/home/priority-actions"
import { RecentEventsFeed } from "@/components/home/recent-events-feed"
import { FailureNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import {
  combineActions,
  combineAuditEvents,
  getLiveActions,
  getLiveAuditEvents,
  getLiveSummaries,
  INITIATIVE_IDS,
} from "@/lib/aggregation"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"
import type { InitiativeId } from "@/lib/domain/contracts"
import { NOT_LOADED } from "@/lib/domain/live-feed"

const HREF: Record<InitiativeId, string> = {
  "initiative-7": initiative7Manifest.href,
  "initiative-8": initiative8Manifest.href,
  "initiative-13": initiative13Manifest.href,
}

/**
 * Home: the landing page (§5). Its one job is answering "what needs my
 * attention today", not showing every metric. The per-module Overview
 * pages (reachable from the sidebar) are where the detailed charts live.
 *
 * Server-rendered from the three modules' live feeds. Each module is fetched
 * independently and settles on its own, so one being down is one failed card,
 * not a blank page and not a zero. Only the priority list is a client
 * component, because re-ranking it for the viewer's role is browser work.
 */
export async function SparesHome() {
  // Without this `next build` would fetch once and serve that snapshot forever.
  await connection()

  const [summaries, actionsPer, auditPer] = await Promise.all([
    getLiveSummaries(),
    getLiveActions(),
    getLiveAuditEvents({ limit: 8 }),
  ])

  const actions = combineActions(actionsPer)
  const audit = combineAuditEvents(auditPer)
  const noneAnswered = actions.failures.length === INITIATIVE_IDS.length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <HomeGreeting />
          <PageHeader title="Here's what needs your attention today" actions={<ProfileMenu />} />
        </div>

        <FailureNotice failures={actions.failures} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INITIATIVE_IDS.map((id) => {
            const section = summaries[id]
            if (section.status !== "ready") {
              return (
                <SummaryCardFailure
                  key={id}
                  label={INITIATIVE_NAME[id]}
                  href={HREF[id]}
                  message={section.message}
                />
              )
            }
            const own = actionsPer[id]
            return (
              <InitiativeSummaryCard
                key={id}
                summary={section.data}
                // null hides the footer when this module's actions did not
                // load: better silent than "0 items need attention".
                attentionCount={own.status === "ready" ? own.data.total : null}
              />
            )
          })}
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
              {noneAnswered
                ? "Could not be determined"
                : actions.decisionTotal === 0 && actions.failures.length === 0
                  ? "Nothing waiting"
                  : "Needs your decision"}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Waiting for a decision</div>
              {/* With no module answering there is no count to give; "0" would
                  read as "nothing is waiting". */}
              <div className="text-sm font-medium text-foreground">
                {noneAnswered ? NOT_LOADED : actions.decisionTotal.toLocaleString()}
              </div>
              {actions.failures.length > 0 && !noneAnswered && (
                <div className="mt-1 text-[11px] text-destructive">
                  Excludes {actions.failures.length} module{actions.failures.length === 1 ? "" : "s"} that
                  could not be loaded
                </div>
              )}
            </div>
          </Link>
        </div>

        <PriorityActions
          actions={actions.actions}
          total={actions.total}
          failedModules={actions.failures.length}
        />

        <MaterialRiskLandscape
          initiative8={summaries["initiative-8"]}
          initiative13={summaries["initiative-13"]}
        />

        <RecentEventsFeed events={audit.events} failedModules={audit.failures.length} />
      </div>
    </div>
  )
}
