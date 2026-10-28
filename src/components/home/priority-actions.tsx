"use client"

import { useMemo, useState } from "react"

import { AttentionRequiredPanel, type ActionFilter, type ActionSort } from "@/components/home/attention-required-panel"
import { useRole } from "@/components/shared/role-context"
import type { GlobalAction } from "@/lib/domain/contracts"
import { sortActionsForRole } from "@/lib/home-priority"

/**
 * Home Priority Actions, re-ranked for whoever the viewer is viewing as.
 *
 * The only client piece of Home: the data arrives as props from the server
 * component, and the role comes from the shared provider, so changing role
 * re-sorts in the browser without a refetch. `sortActionsForRole` is the same
 * pure function as before: no separate data per role, just a different order
 * over one list.
 *
 * The area chips and the sort work over the same loaded list -- nothing is
 * fetched when they change. "Approvals" is the subset each module marked as
 * waiting on a decision (`decisionIds`).
 */
export function PriorityActions({
  actions,
  decisionIds,
  total,
  failedModules,
}: {
  actions: GlobalAction[]
  decisionIds: string[]
  total: number
  failedModules: number
}) {
  const { role } = useRole()
  const [filter, setFilter] = useState<ActionFilter>("all")
  const [sort, setSort] = useState<ActionSort>("urgent")

  const decisions = useMemo(() => new Set(decisionIds), [decisionIds])
  const shown = useMemo(() => {
    const ranked = sortActionsForRole(actions, role)
    const filtered =
      filter === "all"
        ? ranked
        : filter === "approvals"
          ? ranked.filter((a) => decisions.has(a.id))
          : ranked.filter((a) => a.initiative === filter)
    return sort === "newest"
      ? [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : filtered
  }, [actions, role, filter, sort, decisions])

  return (
    <AttentionRequiredPanel
      actions={shown}
      // The real population only means something for the unfiltered list.
      total={filter === "all" ? total : shown.length}
      failedModules={failedModules}
      filter={filter}
      onFilterChange={setFilter}
      sort={sort}
      onSortChange={setSort}
    />
  )
}
