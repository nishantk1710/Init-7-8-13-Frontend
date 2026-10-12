import Link from "next/link"
import { connection } from "next/server"

import { ApprovalsTable } from "@/components/approvals/approvals-table"
import { CappedNotice, FailureNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { combineActions, getLiveActions, INITIATIVE_IDS } from "@/lib/aggregation"
import type { InitiativeId } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { ApprovalsWorkspace } from "@/features/initiative-7/components/approvals-workspace"

export const ALL = "all"
export type ApprovalsFilter = InitiativeId | typeof ALL

/** Reads the `module` search param; anything unrecognised is "all". */
export function parseApprovalsFilter(raw: string | string[] | undefined): ApprovalsFilter {
  const value = Array.isArray(raw) ? undefined : raw
  return INITIATIVE_IDS.find((id) => id === value) ?? ALL
}

/**
 * Approvals — every decision waiting on someone, filterable by module (§26).
 *
 * "Inventory Planning" reuses the same `ApprovalsWorkspace` the Action
 * Center's Inventory Planning tab already renders (one live component
 * instance, not a fork); the other filters are a table over the decisions each
 * module reports as waiting on someone.
 *
 * What counts as "a decision" is each module's own call, made from a structured
 * field on the row (a status, a declaration state) — see the `decisions` list on
 * each initiative's `selectors/live.ts`. It used to be guessed from the wording
 * of the action's title, which silently empties this page the first time a
 * backend phrases a title differently.
 *
 * The filter lives in the URL (`?module=`), so this is a server component: no
 * client state, one fetch, and a filtered view is a link somebody can send.
 */
export async function ApprovalsPage({ filter }: { filter: ApprovalsFilter }) {
  // Without this `next build` would fetch once and serve that snapshot forever.
  await connection()

  const per = await getLiveActions()
  const combined = combineActions(per)

  const approvals = combined.decisions.filter((a) => filter === ALL || a.initiative === filter)

  const chips: { id: ApprovalsFilter; label: string; count: number | null }[] = [
    {
      id: ALL,
      label: "All",
      // With no module answering there is no total; 0 would read as "none waiting".
      count: combined.failures.length === INITIATIVE_IDS.length ? null : combined.decisionTotal,
    },
    ...INITIATIVE_IDS.map((id) => {
      const section = per[id]
      return {
        id,
        label: INITIATIVE_NAME[id],
        // `null` = the module did not answer. Never shown as 0.
        count: section.status === "ready" ? section.data.decisionTotal : null,
      }
    }),
  ]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Approvals"
          description={
            combined.failures.length === INITIATIVE_IDS.length
              ? "How many decisions are waiting could not be determined."
              : `${combined.decisionTotal.toLocaleString()} waiting for a decision${
                  combined.failures.length > 0 ? " (modules that could not be loaded are not counted)" : ""
                }.`
          }
          actions={<ProfileMenu />}
        />

        <FailureNotice failures={combined.failures} />

        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.id}
              href={chip.id === ALL ? "/approvals" : `/approvals?module=${chip.id}`}
              aria-current={filter === chip.id ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                filter === chip.id
                  ? "border-primary/40 bg-accent font-medium text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {chip.label}
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {chip.count === null ? "not loaded" : chip.count.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>

        {filter === "initiative-7" ? (
          <ApprovalsWorkspace />
        ) : (
          <>
            {combined.capped && (
              <CappedNotice
                shown={approvals.length}
                total={
                  filter === ALL
                    ? combined.decisionTotal
                    : (() => {
                        const s = per[filter]
                        return s.status === "ready" ? s.data.decisionTotal : approvals.length
                      })()
                }
                noun="decisions"
              />
            )}
            <ApprovalsTable approvals={approvals} incomplete={combined.failures.length > 0} />
          </>
        )}
      </div>
    </div>
  )
}
