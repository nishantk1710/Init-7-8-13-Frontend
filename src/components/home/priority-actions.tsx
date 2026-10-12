"use client"

import { useMemo } from "react"

import { AttentionRequiredPanel } from "@/components/home/attention-required-panel"
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
 */
export function PriorityActions({
  actions,
  total,
  failedModules,
}: {
  actions: GlobalAction[]
  total: number
  failedModules: number
}) {
  const { role } = useRole()
  const sorted = useMemo(() => sortActionsForRole(actions, role), [actions, role])
  return <AttentionRequiredPanel actions={sorted} total={total} failedModules={failedModules} />
}
