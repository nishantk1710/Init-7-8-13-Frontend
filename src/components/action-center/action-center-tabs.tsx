"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { CappedNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { TablePagination } from "@/components/shared/table-pagination"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { formatWhen } from "@/lib/api/format"
import type { GlobalAction, InitiativeId } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { LiveApprovalsWorkspace, type ApprovalsSummary } from "@/features/initiative-7/components/live-approvals-workspace"
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
export function ActionCenterTabs({
  actions,
  counts,
  total: allTotal,
}: {
  actions: GlobalAction[]
  /** The real population per module — `null` where the module did not answer. */
  counts?: Record<InitiativeId, number | null>
  /** The real population across every module that answered. */
  total?: number
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all")
  const [i7Summary, setI7Summary] = useState<ApprovalsSummary | null>(null)

  const filtered = useMemo(
    () => (tab === "all" ? actions : actions.filter((a) => a.initiative === tab)),
    [actions, tab]
  )
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(filtered, { resetKey: tab })

  // What the selected filter is showing against what exists. A module that did not answer says so rather than
  // reading as an empty list. Shown for every filter, Inventory Planning included.
  let notice: React.ReactNode = null
  if (tab === "all") {
    if (allTotal !== undefined) {
      notice = (
        <CappedNotice shown={paged.length} total={allTotal} noun="open items" description={null} />
      )
    }
  } else if (counts) {
    const moduleTotal = counts[tab]
    if (moduleTotal === null) {
      notice = (
        <AlertBanner tone="info" title={`${INITIATIVE_NAME[tab]} is not loaded`}>
          This module did not answer, so nothing is listed for it. That is not a statement that nothing is open there.
        </AlertBanner>
      )
    } else if (tab === "initiative-7") {
      // This tab lists its own queue, not the aggregate feed above, so the card reports what that queue is showing --
      // nothing until it has loaded.
      if (i7Summary) {
        notice = (
          <CappedNotice shown={i7Summary.shown} total={i7Summary.total} noun="recommendations" description={null} />
        )
      }
    } else {
      notice = (
        <CappedNotice shown={paged.length} total={moduleTotal} noun="open items" description={null} />
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The "Showing X of Y" section, where it has always been: above the filter, and following the selected filter. */}
      {notice}
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number]["id"])}>
        <TabsList className="w-full max-w-4xl border-2 border-primary/40 bg-card p-1 shadow-lg ring-0 group-data-horizontal/tabs:h-11">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="px-4 font-semibold text-foreground/70 duration-300 ease-out data-active:border-primary data-active:bg-background data-active:text-foreground data-active:shadow-md dark:data-active:border-primary dark:data-active:bg-background dark:data-active:text-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Keyed on the tab so the content re-mounts and fades in on every filter change -- but not on a page change within
          a tab. The motion is dropped for anyone who has asked for reduced motion. */}
      <div
        key={tab}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none"
      >
        {tab === "initiative-7" ? (
          <LiveApprovalsWorkspace onSummaryChange={setI7Summary} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nothing here" description="No open actions in this module right now." />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
              {paged.map((action) => {
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
                          Created {formatWhen(action.createdAt)}
                          {action.dueAt && <> · Due {formatWhen(action.dueAt)}</>}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              count={paged.length}
              noun="actions"
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
