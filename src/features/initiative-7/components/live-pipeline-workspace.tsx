// Part 22 — I07 complete frontend live data integration.
//
// Live counterpart to pipeline-workspace.tsx. The scenario version buckets
// by per-role approval stage (Not submitted -> End User -> ... -> Approved),
// which needs bulk per-recommendation workflow state (route/pending-role for
// every row) that no endpoint currently returns cheaply for a whole list --
// see live-approvals-workspace.tsx's same limitation. This live version
// instead buckets by the real backend lifecycle status directly, which the
// list endpoint already returns per row -- an honest reduction, not an
// attempt to recreate the exact same stage granularity without the data to
// back it.

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, formatCount } from "@/lib/utils"
import { useLiveRecommendationSummary } from "@/features/initiative-7/hooks/use-live-recommendation-summary"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { mapStatus } from "@/features/initiative-7/services/i7-api"
import type { RecommendationStatus } from "@/features/initiative-7/types/inventory"

const ALL = "all"
const LIVE_PIPELINE_PAGE_SIZE = 200

type StatusTab = "in-flight" | "completed" | "not-submitted"

/** Every real backend RecommendationStatus this reduction recognises,
 * grouped for the stage strip -- mirrors mapStatus's own reduction in
 * i7-api.ts so the labels here are consistent with the badges elsewhere. */
const STAGES: RecommendationStatus[] = [
  "Pending Review",
  "In Approval",
  "Returned",
  "Approved",
  "Rejected",
  "Implemented",
]

const STATUS_TONE: Record<RecommendationStatus, "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

/** The tab bucket a display status belongs to -- mirrors the scenario
 * version's tabFor() reduction, applied to the mapped status rather than a
 * full Recommendation (this file no longer keeps an unfiltered Recommendation[]
 * around to derive a tab from -- see LivePipelineWorkspace's own comment). */
function tabForStatus(status: RecommendationStatus): StatusTab {
  if (status === "Pending Review") return "not-submitted"
  if (status === "Approved" || status === "Implemented" || status === "Rejected") return "completed"
  return "in-flight"
}

/** Days since `updatedAt` (submit/hold/approve/reject all update the row in
 * place -- see the schema's own updated_at docstring), against wall-clock
 * "now" -- unlike the scenario version's waitingDays(), live data has no
 * fixed dataset reference date to measure against. */
function liveWaitingDays(updatedAt: string | undefined): number | null {
  if (!updatedAt) return null
  const parsed = new Date(updatedAt).getTime()
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.round((Date.now() - parsed) / 86_400_000))
}

/** Same thresholds as the scenario version's pipelineHealth() -- illustrative,
 * not an agreed SLA -- applied only to rows still actually in motion
 * (in-flight); a completed or not-yet-submitted row is never "stuck". */
function liveHealth(days: number | null): "On track" | "Slow" | "Stuck" | null {
  if (days === null) return null
  if (days > 14) return "Stuck"
  if (days > 7) return "Slow"
  return "On track"
}

const HEALTH_TONE: Record<"On track" | "Slow" | "Stuck", "success" | "warning" | "danger"> = {
  "On track": "success",
  Slow: "warning",
  Stuck: "danger",
}

/** Every raw backend LifecycleStatus this page recognises, each fetched
 * unconditionally on every render (a fixed, compile-time-known list -- never
 * a dynamic per-tab array) so the table is always built from rows actually
 * matching a real status, not one arbitrary unfiltered page. A 200-row page
 * ordered by generated_at ascending, out of ~113k rows almost all Pending
 * Review, essentially never contains the handful of real In Approval/
 * Approved/Rejected rows -- which is exactly why the stage strip could show
 * "In flight: 1" while the table below showed nothing. Twelve small,
 * cheap, parallel-by-the-browser requests, each scoped to one status, is a
 * defensible cost for a table the size this data actually has (a few dozen
 * rows total outside Pending Review on the current extract). */
const ALL_RAW_STATUSES = [
  "NOT_EVALUABLE",
  "READY_FOR_REVIEW",
  "PENDING_APPROVAL",
  "HELD",
  "ADJUSTED",
  "SENT_BACK",
  "APPROVED",
  "SAP_EXECUTION_PENDING",
  "REJECTED",
  "SAP_EXECUTED",
  "ADOPTED",
  "PARTIALLY_ADOPTED",
  "NOT_ADOPTED",
] as const

export function LivePipelineWorkspace() {
  const { openMaterial360 } = useMaterial360()
  // Part 37 -- portfolio-wide counts, not one fetched page's: with ~113k
  // accumulated rows almost all Pending Review, a 200-row page (like every
  // other portfolio-count bug found this session -- Pending Approval KPI,
  // Stockout Risk Distribution, Recommendation status) reads as "everything
  // is Not submitted, nothing else exists" even when real In-flight/
  // Completed rows exist elsewhere in the full set.
  const { summary } = useLiveRecommendationSummary()
  const [tab, setTab] = useState<StatusTab>("in-flight")
  const [stage, setStage] = useState<string>(ALL)
  const [query, setQuery] = useState("")

  // One hook call per fixed status -- see ALL_RAW_STATUSES's own comment on
  // why this is a fixed, not dynamic, hook count.
  const byStatus = {
    NOT_EVALUABLE: useLiveRecommendations({ status: "NOT_EVALUABLE", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    READY_FOR_REVIEW: useLiveRecommendations({ status: "READY_FOR_REVIEW", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    PENDING_APPROVAL: useLiveRecommendations({ status: "PENDING_APPROVAL", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    HELD: useLiveRecommendations({ status: "HELD", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    ADJUSTED: useLiveRecommendations({ status: "ADJUSTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    SENT_BACK: useLiveRecommendations({ status: "SENT_BACK", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    APPROVED: useLiveRecommendations({ status: "APPROVED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    SAP_EXECUTION_PENDING: useLiveRecommendations({
      status: "SAP_EXECUTION_PENDING",
      pageSize: LIVE_PIPELINE_PAGE_SIZE,
    }),
    REJECTED: useLiveRecommendations({ status: "REJECTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    SAP_EXECUTED: useLiveRecommendations({ status: "SAP_EXECUTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    ADOPTED: useLiveRecommendations({ status: "ADOPTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    PARTIALLY_ADOPTED: useLiveRecommendations({ status: "PARTIALLY_ADOPTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
    NOT_ADOPTED: useLiveRecommendations({ status: "NOT_ADOPTED", pageSize: LIVE_PIPELINE_PAGE_SIZE }),
  }

  const activeStatuses =
    stage !== ALL
      ? [stage as (typeof ALL_RAW_STATUSES)[number]]
      : ALL_RAW_STATUSES.filter((raw) => tabForStatus(mapStatus(raw)) === tab)

  const active = activeStatuses.map((raw) => byStatus[raw])
  const loading = active.some((f) => f.loading)
  const error = active.find((f) => f.error)?.error ?? null
  const refetch = () => active.forEach((f) => f.refetch())
  const data = active.every((f) => f.data) ? active.flatMap((f) => f.data ?? []) : null

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>(STAGES.map((s) => [s, 0]))
    if (summary) {
      for (const row of summary.byStatus) {
        const status = mapStatus(row.status)
        if (counts.has(status)) counts.set(status, (counts.get(status) ?? 0) + row.count)
      }
    }
    return counts
  }, [summary])

  const tabCounts = useMemo(() => {
    const counts = { "in-flight": 0, completed: 0, "not-submitted": 0 }
    if (summary) {
      for (const row of summary.byStatus) {
        counts[tabForStatus(mapStatus(row.status))] += row.count
      }
    }
    return counts
  }, [summary])

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (data ?? []).filter((rec) => {
      if (search) {
        const haystack = `${rec.material.materialId} ${rec.material.description}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [data, query])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-4" />}
        title="Could not load the pipeline from the backend"
        description={error.message}
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "not-submitted", label: "Not submitted" },
            { key: "in-flight", label: "In flight" },
            { key: "completed", label: "Completed" },
          ] as { key: StatusTab; label: string }[]
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              tab === option.key
                ? "border-warning/40 bg-warning/10 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
            <span className="font-semibold tabular-nums text-foreground">{formatCount(tabCounts[option.key])}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Recommendations by lifecycle status</div>
        <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
          {STAGES.map((stageName) => {
            const count = stageCounts.get(stageName) ?? 0
            const isEmpty = count === 0
            const rawForStage = ALL_RAW_STATUSES.filter((raw) => mapStatus(raw) === stageName)
            const isActive = rawForStage.includes(stage as (typeof ALL_RAW_STATUSES)[number])
            return (
              <button
                key={stageName}
                type="button"
                onClick={() => setStage(isActive ? ALL : rawForStage[0])}
                className={cn(
                  "min-w-[128px] flex-1 rounded-lg border p-3 text-left transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40"
                )}
              >
                <div className={cn("truncate text-2xl font-semibold tabular-nums", isEmpty ? "text-muted-foreground" : "text-primary")}>
                  {formatCount(count)}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{stageName}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track a material..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select value={stage} onValueChange={(v) => setStage(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="All stages">
              {(v: string) => (v === ALL ? "All stages" : mapStatus(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {ALL_RAW_STATUSES.map((raw) => (
              <SelectItem key={raw} value={raw}>
                {mapStatus(raw)} ({raw})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing matches this view" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((rec) => {
                const isInFlight = tabForStatus(rec.status) === "in-flight"
                const days = isInFlight ? liveWaitingDays(rec.updatedAt) : null
                const health = liveHealth(days)
                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
                        <MaterialIdentity material={rec.material} onOpen={openMaterial360} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={rec.risk} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[rec.status]}>{rec.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-[13px] tabular-nums text-muted-foreground">
                      {days !== null ? `${days} day${days === 1 ? "" : "s"}` : "—"}
                    </TableCell>
                    <TableCell>
                      {health ? (
                        <StatusBadge tone={HEALTH_TONE[health]}>{health}</StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {new Date(rec.generatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Live backend data. &quot;Waiting&quot; and &quot;Health&quot; are measured from each recommendation&apos;s
        last status change (a submit/hold/approve/reject action updates the row in place) against the current time
        — &quot;Slow&quot; past 7 days, &quot;Stuck&quot; past 14, illustrative thresholds, not an agreed SLA. Only
        shown for recommendations actually in flight; a row not yet submitted or already completed cannot be
        stuck.
      </p>
    </div>
  )
}
