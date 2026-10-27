import { connection } from "next/server"

import { AttentionTotalCard, type AreaCount } from "@/components/home/attention-total-card"
import { APPROVALS_BORDER } from "@/components/home/home-areas"
import { HomeGreeting } from "@/components/home/home-greeting"
import { AreaCard, InitiativeSummaryCard, SummaryCardFailure } from "@/components/home/initiative-summary-card"
import { MaterialRiskLandscape } from "@/components/home/material-risk-landscape"
import { PriorityActions } from "@/components/home/priority-actions"
import { RecentEventsFeed } from "@/components/home/recent-events-feed"
import { FailureNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
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
  const areaCounts: AreaCount[] = INITIATIVE_IDS.flatMap((id) => {
    const own = actionsPer[id]
    return own.status === "ready" ? [{ id, count: own.data.total }] : []
  })

  return (
    <div className="nav-blue-scope min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <HomeGreeting />
            <h1 className="mt-0.5 text-2xl leading-tight font-semibold tracking-tight text-foreground">
              Here&rsquo;s what needs your attention today
            </h1>
          </div>
          <div className="shrink-0">
            <ProfileMenu />
          </div>
        </header>

        <FailureNotice failures={actions.failures} />

        {!noneAnswered && (
          <AttentionTotalCard
            areas={areaCounts}
            decisionTotal={actions.decisionTotal}
            failedModules={actions.failures.length}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <AreaCard
            href="/approvals"
            label="Pending Approvals"
            edge={APPROVALS_BORDER}
            status={
              <StatusPill tone={noneAnswered ? "urgent" : actions.decisionTotal === 0 ? "healthy" : "primary"}>
                {noneAnswered
                  ? "Could not be determined"
                  : actions.decisionTotal === 0 && actions.failures.length === 0
                    ? "Nothing waiting"
                    : "Needs your decision"}
              </StatusPill>
            }
            footer={
              actions.failures.length > 0 && !noneAnswered ? (
                <span className="text-destructive">
                  Excludes {actions.failures.length} module{actions.failures.length === 1 ? "" : "s"} that could
                  not be loaded
                </span>
              ) : null
            }
          >
            <div>
              <div className="text-xs text-muted-foreground">Waiting for a decision</div>
              {/* With no module answering there is no count to give; "0" would
                  read as "nothing is waiting". */}
              <div className="text-[30px] leading-tight font-semibold tracking-tight text-action tabular-nums">
                {noneAnswered ? NOT_LOADED : actions.decisionTotal.toLocaleString()}
              </div>
            </div>
          </AreaCard>
        </div>

        <PriorityActions
          actions={actions.actions}
          decisionIds={actions.decisions.map((d) => d.id)}
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
