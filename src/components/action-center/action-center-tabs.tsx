"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GlobalAction, InitiativeId } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { ApprovalsWorkspace } from "@/features/initiative-7/components/approvals-workspace"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

// Product-facing names only, sourced from each module's manifest.
const TABS: { id: InitiativeId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "initiative-7", label: initiative7Manifest.name },
  { id: "initiative-8", label: initiative8Manifest.name },
  { id: "initiative-13", label: initiative13Manifest.name },
]

const SEVERITY_ICON = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleAlert,
} as const

const SEVERITY_CLASS = {
  info: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const

/**
 * The Global Action Center is initiative-agnostic for every module except
 * Inventory Planning: that tab renders the module's own full
 * ApprovalsWorkspace (queues, filters, sort, the change table, the
 * per-recommendation approval-chain panel) instead of the generic flat list,
 * since that workflow needs more than "title + severity + a link" can carry.
 * Every other tab stays a plain filter over the aggregated `GlobalAction[]`.
 */
export function ActionCenterTabs({ actions }: { actions: GlobalAction[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all")

  const filtered = useMemo(
    () => (tab === "all" ? actions : actions.filter((a) => a.initiative === tab)),
    [actions, tab]
  )

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number]["id"])}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {t.id !== "all" && (
                <span className="ml-1 text-[11px] text-muted-foreground">
                  ({actions.filter((a) => a.initiative === t.id).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "initiative-7" ? (
        <ApprovalsWorkspace />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No open actions in this module right now." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((action) => {
            const Icon = SEVERITY_ICON[action.severity]
            return (
              <li key={action.id}>
                <Link
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <Icon className={cn("size-4 shrink-0", SEVERITY_CLASS[action.severity])} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{action.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Created {action.createdAt}
                      {action.dueAt && <> · Due {action.dueAt}</>}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
