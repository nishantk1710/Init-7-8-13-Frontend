import { connection } from "next/server"

import { ApprovalsView, type ApprovalsChip } from "@/components/approvals/approvals-view"
import { FailureNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { combineActions, getLiveActions, INITIATIVE_IDS } from "@/lib/aggregation"
import type { InitiativeId } from "@/lib/domain/contracts"

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

  const chips: ApprovalsChip[] = [
    { id: ALL, label: "All", href: "/approvals" },
    ...INITIATIVE_IDS.map((id) => ({ id, label: INITIATIVE_NAME[id], href: `/approvals?module=${id}` })),
  ]

  // The real number of decisions behind the selected filter, for the "Showing X of Y" card. `null` = it could not be
  // determined (no module answered, or the selected one did not), never 0 -- 0 would read as "none waiting".
  const selected = filter === ALL ? null : per[filter]
  const total =
    filter === ALL
      ? combined.failures.length === INITIATIVE_IDS.length
        ? null
        : combined.decisionTotal
      : selected && selected.status === "ready"
        ? selected.data.decisionTotal
        : null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader title="Approvals" actions={<ProfileMenu />} />

        <FailureNotice failures={combined.failures} />

        <ApprovalsView
          filter={filter}
          chips={chips}
          approvals={approvals}
          total={total}
          moduleName={filter === ALL ? "" : INITIATIVE_NAME[filter]}
          notLoaded={selected !== null && selected.status !== "ready"}
          incomplete={combined.failures.length > 0}
        />
      </div>
    </div>
  )
}
