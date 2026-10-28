import { connection } from "next/server"
import { ClipboardCheck } from "lucide-react"

import { AttentionTotalCard, type AreaCount } from "@/components/home/attention-total-card"
import { APPROVALS_ACCENT } from "@/components/home/home-areas"
import { HomeGreeting } from "@/components/home/home-greeting"
import type { ActionFilter } from "@/components/home/attention-required-panel"
import { AreaCard, InitiativeSummaryCard, MetricTile, SummaryCardFailure } from "@/components/home/initiative-summary-card"
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

  // The real open-item count behind each Priority actions tab. A module that did
  // not answer has no entry, so its tab shows no count rather than a 0, and with
  // nothing answering there is no total either.
  const filterCounts: Partial<Record<ActionFilter, number>> = {
    ...Object.fromEntries(areaCounts.map((a) => [a.id, a.count])),
    ...(noneAnswered ? {} : { all: actions.total, approvals: actions.decisionTotal }),
  }

  return (
    // `oar-scope` (globals.css) is the blue page theme the OAR screens use: page
    // background, slate ink and borders, the sidebar's blue as the primary.
    <div className="oar-scope min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <HomeGreeting />
            <h1 className="mt-0.5 text-xl font-semibold text-foreground">
              Here&rsquo;s what needs your attention today
            </h1>
          </div>
          <div className="ml-auto shrink-0">
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            accent={APPROVALS_ACCENT}
            icon={<ClipboardCheck className="size-3.5" />}
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
            <dl className="grid grid-cols-1 gap-2.5">
              {/* With no module answering there is no count to give; "0" would
                  read as "nothing is waiting". */}
              <MetricTile
                label="Waiting for a decision"
                value={noneAnswered ? NOT_LOADED : actions.decisionTotal.toLocaleString()}
                valueClassName="text-action"
              />
            </dl>
          </AreaCard>
        </div>

        {/* The work list takes two thirds, the activity feed the third beside it;
            `h-full` on the child makes both panels the height of the taller. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2 [&>*]:h-full">
            <PriorityActions
              actions={actions.actions}
              decisionIds={actions.decisions.map((d) => d.id)}
              total={actions.total}
              failedModules={actions.failures.length}
              counts={filterCounts}
            />
          </div>
          <div className="min-w-0 [&>*]:h-full">
            <RecentEventsFeed events={audit.events} failedModules={audit.failures.length} />
          </div>
        </div>
      </div>
    </div>
  )
}
